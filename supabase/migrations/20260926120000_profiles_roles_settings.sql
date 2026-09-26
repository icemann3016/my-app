-- M1: profiles, private user settings and roles (#12, #13).
-- See docs/implementation-plan.md §5. Every table has RLS; users can only change their own rows
-- and only the columns granted below.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('pilot', 'owner', 'admin');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Roles a user has switched on. Users manage pilot/owner themselves; admin is granted with SQL only.';

alter table public.user_roles enable row level security;

create policy "Roles are public"
  on public.user_roles for select
  to anon, authenticated
  using (true);

create policy "Users can add their own pilot or owner role"
  on public.user_roles for insert
  to authenticated
  with check (user_id = (select auth.uid()) and role in ('pilot', 'owner'));

create policy "Users can remove their own pilot or owner role"
  on public.user_roles for delete
  to authenticated
  using (user_id = (select auth.uid()) and role in ('pilot', 'owner'));

revoke update on public.user_roles from anon, authenticated;

create or replace function public.user_has_role(check_role public.app_role, check_user uuid default auth.uid())
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles where user_id = check_user and role = check_role
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles (public information)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  bio text check (char_length(bio) <= 1000),
  avatar_path text,
  -- ICAO code for now; becomes a reference to public.airports in M2.
  home_airport_icao text check (home_airport_icao ~ '^[A-Z0-9]{4}$'),
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile, one per user, created automatically on sign-up. Never store private data here.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rows are created by the sign-up trigger and deleted with the auth user.
-- Users may only change these columns (not ratings or suspension).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, bio, avatar_path, home_airport_icao) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- User settings (private, only visible to the user)
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'bg')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Users can read their own settings"
  on public.user_settings for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can update their own settings"
  on public.user_settings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.user_settings from anon;
revoke insert, update, delete on public.user_settings from authenticated;
grant update (locale, units) on public.user_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Create profile + settings when a user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text;
begin
  name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),  -- Google
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Pilot'
  );

  insert into public.profiles (id, display_name) values (new.id, left(name, 80));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this migration.
insert into public.profiles (id, display_name)
select id, coalesce(nullif(split_part(coalesce(email, ''), '@', 1), ''), 'Pilot')
from auth.users
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Avatar storage: public bucket, each user writes only to the folder named after their id
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Size and type limits (these columns exist on hosted Supabase; guarded for older local schemas).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets
    set file_size_limit = 2097152, -- 2 MB
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
    where id = 'avatars';
  end if;
end;
$$;

create policy "Users can read their own avatar files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can replace their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
