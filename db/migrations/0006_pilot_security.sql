-- M3 security: pilot credentials (licences, ratings, medicals, experience), documents, admin log.
-- Pilots manage their own rows; admins read everything. Status changes (verify/reject) are done by
-- trusted admin code with the owner connection after checking the admin role.

-- Timestamps ------------------------------------------------------------------
-- Credentials: new rows always get fresh timestamps (users can't pick them), and updated_at
-- moves only for real changes, not for the reminder bookkeeping (reminder_sent_at). Admins use
-- updated_at to make sure they verify exactly what they looked at.
CREATE OR REPLACE FUNCTION public.credential_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSIF (to_jsonb(NEW) - ARRAY['reminder_sent_at', 'updated_at'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['reminder_sent_at', 'updated_at']) THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pilot_licences_timestamps BEFORE INSERT OR UPDATE ON public.pilot_licences
  FOR EACH ROW EXECUTE FUNCTION public.credential_timestamps();
--> statement-breakpoint
CREATE TRIGGER pilot_ratings_timestamps BEFORE INSERT OR UPDATE ON public.pilot_ratings
  FOR EACH ROW EXECUTE FUNCTION public.credential_timestamps();
--> statement-breakpoint
CREATE TRIGGER medicals_timestamps BEFORE INSERT OR UPDATE ON public.medicals
  FOR EACH ROW EXECUTE FUNCTION public.credential_timestamps();
--> statement-breakpoint
CREATE TRIGGER pilot_experience_set_updated_at BEFORE UPDATE ON public.pilot_experience
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint

-- Changing a credential sends it back for review ------------------------------
-- (e.g. a verified licence whose number is edited becomes "pending" again).
CREATE OR REPLACE FUNCTION public.reset_review_on_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  meta text[] := ARRAY['status', 'rejection_reason', 'reviewed_by', 'reviewed_at',
                       'reminder_sent_at', 'created_at', 'updated_at'];
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND (to_jsonb(NEW) - meta) IS DISTINCT FROM (to_jsonb(OLD) - meta) THEN
    NEW.status := 'pending';
    NEW.rejection_reason := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.reminder_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pilot_licences_reset_review BEFORE UPDATE ON public.pilot_licences
  FOR EACH ROW EXECUTE FUNCTION public.reset_review_on_change();
--> statement-breakpoint
CREATE TRIGGER pilot_ratings_reset_review BEFORE UPDATE ON public.pilot_ratings
  FOR EACH ROW EXECUTE FUNCTION public.reset_review_on_change();
--> statement-breakpoint
CREATE TRIGGER medicals_reset_review BEFORE UPDATE ON public.medicals
  FOR EACH ROW EXECUTE FUNCTION public.reset_review_on_change();
--> statement-breakpoint

-- documents: owner and admins read; owner uploads and deletes ------------------
GRANT SELECT, INSERT, DELETE ON public.documents TO app_user;
--> statement-breakpoint
CREATE POLICY documents_select ON public.documents FOR SELECT TO app_user
  USING (owner_id = app.current_user_id() OR public.user_has_role('admin'));
--> statement-breakpoint
CREATE POLICY documents_insert ON public.documents FOR INSERT TO app_user
  WITH CHECK (owner_id = app.current_user_id()
    AND storage_key LIKE 'documents/' || app.current_user_id()::text || '/%');
--> statement-breakpoint
CREATE POLICY documents_delete ON public.documents FOR DELETE TO app_user
  USING (owner_id = app.current_user_id());
--> statement-breakpoint

-- Credentials: same rules for licences, ratings and medicals --------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pilot_licences', 'pilot_ratings', 'medicals'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON public.%I TO app_user', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO app_user
         USING (user_id = app.current_user_id() OR public.user_has_role(''admin''))',
      t || '_select', t);
    -- New rows always start as pending, unreviewed, and may only use the user's own document.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO app_user
         WITH CHECK (user_id = app.current_user_id()
           AND status = ''pending'' AND rejection_reason IS NULL AND reviewed_by IS NULL
           AND reviewed_at IS NULL AND reminder_sent_at IS NULL
           AND (document_id IS NULL OR EXISTS (
             SELECT 1 FROM public.documents d
             WHERE d.id = document_id AND d.owner_id = app.current_user_id())))',
      t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO app_user
         USING (user_id = app.current_user_id())
         WITH CHECK (user_id = app.current_user_id()
           AND (document_id IS NULL OR EXISTS (
             SELECT 1 FROM public.documents d
             WHERE d.id = document_id AND d.owner_id = app.current_user_id())))',
      t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO app_user
         USING (user_id = app.current_user_id())',
      t || '_delete', t);
  END LOOP;
END
$$;
--> statement-breakpoint
-- Users may change the data columns, never the review columns.
GRANT UPDATE (type, issuing_state, number, issued_on, expires_on, document_id)
  ON public.pilot_licences TO app_user;
--> statement-breakpoint
GRANT UPDATE (kind, code, expires_on, document_id) ON public.pilot_ratings TO app_user;
--> statement-breakpoint
GRANT UPDATE (class, issuing_state, valid_until, document_id) ON public.medicals TO app_user;
--> statement-breakpoint

-- Experience: self-declared, private to the pilot (and admins) -----------------
GRANT SELECT, INSERT, DELETE ON public.pilot_experience, public.experience_by_type TO app_user;
--> statement-breakpoint
GRANT UPDATE (total_hours, pic_hours, last_90_days_hours) ON public.pilot_experience TO app_user;
--> statement-breakpoint
GRANT UPDATE (hours) ON public.experience_by_type TO app_user;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pilot_experience', 'experience_by_type'] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO app_user
         USING (user_id = app.current_user_id() OR public.user_has_role(''admin''))',
      t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO app_user WITH CHECK (user_id = app.current_user_id())',
      t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO app_user
         USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id())',
      t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO app_user USING (user_id = app.current_user_id())',
      t || '_delete', t);
  END LOOP;
END
$$;
--> statement-breakpoint

-- Admin audit log: admins can read it; entries are written by trusted admin code ----
GRANT SELECT ON public.admin_actions TO app_user;
--> statement-breakpoint
CREATE POLICY admin_actions_select ON public.admin_actions FOR SELECT TO app_user
  USING (public.user_has_role('admin'));
--> statement-breakpoint

-- Public badges: only verified, unexpired licence types and ratings (never numbers,
-- documents or medical data). SECURITY DEFINER so profiles can show them without
-- opening the credential tables to other users.
CREATE OR REPLACE FUNCTION public.pilot_badges(pilot uuid)
RETURNS TABLE (kind text, code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT 'licence'::text, l.type::text
  FROM public.pilot_licences l
  WHERE l.user_id = pilot AND l.status = 'verified'
    AND (l.expires_on IS NULL OR l.expires_on >= (now() AT TIME ZONE 'utc')::date)
  UNION
  SELECT DISTINCT r.kind::text, r.code
  FROM public.pilot_ratings r
  WHERE r.user_id = pilot AND r.status = 'verified'
    AND (r.expires_on IS NULL OR r.expires_on >= (now() AT TIME ZONE 'utc')::date)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.pilot_badges(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.pilot_badges(uuid) TO app_user;
