-- RLS and trigger tests for profiles, user_settings, user_roles and the avatars bucket (#12, #13).
-- Run with: npx supabase test db   (needs a local Supabase; also runs in CI)
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

-- Test users (inserted the way Supabase Auth does it)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"display_name": "Alice Pilot"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{}');

-- Sign-up trigger ------------------------------------------------------------
select is((select display_name from profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice Pilot', 'profile uses display_name from sign-up metadata');
select is((select display_name from profiles where id = '22222222-2222-2222-2222-222222222222'),
  'bob', 'profile falls back to the email name');
select is((select count(*) from user_settings where user_id in
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
  2::bigint, 'settings row created for each new user');

-- RLS is on ------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass), 'RLS on user_settings');
select ok((select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass), 'RLS on user_roles');

-- Anonymous visitor ----------------------------------------------------------
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select ok((select count(*) from profiles) >= 2, 'anon can read public profiles');
select throws_ok('select * from public.user_settings', '42501', null, 'anon cannot read settings');
select throws_ok($$ insert into public.user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111', 'pilot') $$,
  '42501', null, 'anon cannot add roles');
select throws_ok($$ update public.profiles set display_name = 'x' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'anon cannot update profiles');

-- Alice (logged in) ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select lives_ok($$ update public.profiles set display_name = 'Alice P.', bio = 'PPL(A), SEP', home_airport_icao = 'LBSF'
  where id = '11111111-1111-1111-1111-111111111111' $$, 'user can update own profile');
select is((select display_name from profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice P.', 'own profile change saved');
select is_empty($$ update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222' returning id $$,
  'user cannot update someone else''s profile');
select throws_ok($$ update public.profiles set rating_avg = 5 where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'user cannot change own rating');
select throws_ok($$ update public.profiles set suspended_at = null where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'user cannot change suspension');
select throws_ok($$ update public.profiles set home_airport_icao = 'sofia' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'home airport must be a 4-character ICAO code');

select is((select count(*) from user_settings), 1::bigint, 'user sees only own settings');
select lives_ok($$ update public.user_settings set locale = 'bg', units = 'imperial'
  where user_id = '11111111-1111-1111-1111-111111111111' $$, 'user can update own settings');

select lives_ok($$ insert into public.user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111', 'pilot') $$,
  'user can switch on pilot role');
select throws_ok($$ insert into public.user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111', 'admin') $$,
  '42501', null, 'user cannot make themselves admin');
select throws_ok($$ insert into public.user_roles (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'owner') $$,
  '42501', null, 'user cannot add roles for someone else');
select lives_ok($$ delete from public.user_roles where user_id = '11111111-1111-1111-1111-111111111111' and role = 'pilot' $$,
  'user can switch off own role');

select lives_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', '11111111-1111-1111-1111-111111111111/avatar.png') $$,
  'user can upload to own avatar folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', '22222222-2222-2222-2222-222222222222/avatar.png') $$,
  '42501', null, 'user cannot upload to someone else''s avatar folder');

-- Back to the database owner -------------------------------------------------
reset role;
insert into user_roles (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'admin');
select ok(public.user_has_role('admin', '22222222-2222-2222-2222-222222222222'), 'user_has_role() detects admin');

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is((select count(*) from profiles where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint, 'deleting the auth user deletes the profile');

select * from finish();
rollback;
