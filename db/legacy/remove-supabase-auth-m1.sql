-- ONE-TIME cleanup for the Supabase dev project (Sept 2026).
-- Removes the first M1 version, which used Supabase Auth, so the new portable migrations
-- (db/migrations) can create their own users/profiles tables.
-- Run once in Supabase → SQL Editor, then `npm run db:migrate`. Deletes test data only.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.user_roles, public.user_settings, public.profiles cascade;
drop function if exists public.user_has_role(public.app_role, uuid);
drop function if exists public.set_updated_at();
drop type if exists public.app_role;

drop policy if exists "Users can read their own avatar files" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can replace their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

-- Old test accounts created with Supabase Auth (the app no longer uses them).
delete from auth.users;
