-- M1 security: runtime role, current-user function, triggers, Row Level Security and grants.
-- The app runs user queries as role app_user with app.user_id set (see lib/db/rls.ts), so the
-- policies below decide what each user can see and change. Plain PostgreSQL 14+, so it works on
-- Supabase, Google Cloud SQL, Azure Database for PostgreSQL and a local Postgres alike.

-- Runtime role ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
-- Allow the login user that runs the migrations (and the app) to SET ROLE app_user.
-- If the app later logs in as a different user, run: GRANT app_user TO <that_user>;
GRANT app_user TO CURRENT_USER;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO app_user;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint

-- Helpers ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.current_user_id() TO app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.user_has_role(
  check_role public.app_role,
  check_user uuid DEFAULT app.current_user_id()
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = check_user AND role = check_role
  )
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.user_has_role(public.app_role, uuid) TO app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER user_settings_set_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint

-- New user → profile + settings (same transaction as the sign-up) --------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  display text;
BEGIN
  display := coalesce(
    nullif(btrim(NEW.name), ''),
    nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
    'Pilot'
  );
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, left(display, 80));
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER users_create_profile AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- profiles: public read, owner edits a few columns ----------------------------
GRANT SELECT ON public.profiles TO app_user;
--> statement-breakpoint
GRANT UPDATE (display_name, bio, avatar_key, home_airport_icao) ON public.profiles TO app_user;
--> statement-breakpoint
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT TO app_user USING (true);
--> statement-breakpoint
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO app_user
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());
--> statement-breakpoint

-- user_settings: private to the user -------------------------------------------
GRANT SELECT ON public.user_settings TO app_user;
--> statement-breakpoint
GRANT UPDATE (locale, units) ON public.user_settings TO app_user;
--> statement-breakpoint
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO app_user USING (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint

-- user_roles: public read; users switch pilot/owner on and off; admin only via SQL ---
GRANT SELECT, INSERT, DELETE ON public.user_roles TO app_user;
--> statement-breakpoint
CREATE POLICY user_roles_select_all ON public.user_roles
  FOR SELECT TO app_user USING (true);
--> statement-breakpoint
CREATE POLICY user_roles_insert_own ON public.user_roles
  FOR INSERT TO app_user
  WITH CHECK (user_id = app.current_user_id() AND role IN ('pilot', 'owner'));
--> statement-breakpoint
CREATE POLICY user_roles_delete_own ON public.user_roles
  FOR DELETE TO app_user
  USING (user_id = app.current_user_id() AND role IN ('pilot', 'owner'));
--> statement-breakpoint

-- Auth tables (users, sessions, accounts, verifications, rate_limits): RLS is on and
-- app_user gets no grants, so only the owner connection used by Better Auth can read them.

-- Hosted Supabase exposes the public schema over its REST API to the "anon" and
-- "authenticated" roles. We don't use that API: take their access away (no-op elsewhere).
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
