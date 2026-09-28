-- M7/M9 reports (RAT-5, ADM-3) and the owner's reply to a review (RAT-5). Anyone logged in
-- reports what they can see (the check runs with their own rights, so RLS decides); reporters see
-- their own reports, admins all of them. Admins resolve reports with the owner connection after
-- requireAdmin() (lib/admin), like credential reviews.

-- Can the current user see this target? Runs as the caller (SECURITY INVOKER), so RLS applies.
CREATE OR REPLACE FUNCTION public.report_target_visible(kind public.report_target, target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN CASE kind
    WHEN 'review' THEN EXISTS (SELECT 1 FROM public.reviews WHERE id = target)
    WHEN 'user' THEN EXISTS (SELECT 1 FROM public.profiles WHERE id = target)
    WHEN 'aircraft' THEN EXISTS (SELECT 1 FROM public.aircraft WHERE id = target)
    ELSE false END;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.report_target_visible(public.report_target, uuid) TO app_user;
--> statement-breakpoint

GRANT SELECT ON public.reports TO app_user;
--> statement-breakpoint
-- Table-level INSERT (Drizzle lists every column); the trigger below fixes the system columns.
GRANT INSERT ON public.reports TO app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reports_new()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.created_at := now();
  NEW.details := nullif(btrim(coalesce(NEW.details, '')), '');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER reports_new BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_new();
--> statement-breakpoint
CREATE POLICY reports_select ON public.reports FOR SELECT TO app_user
  USING (reporter_id = app.current_user_id() OR public.user_has_role('admin'));
--> statement-breakpoint
CREATE POLICY reports_insert ON public.reports FOR INSERT TO app_user
  WITH CHECK (reporter_id = app.current_user_id() AND status = 'open'
    AND resolved_at IS NULL AND resolved_by IS NULL AND resolution IS NULL
    AND public.report_target_visible(target_type, target_id));
--> statement-breakpoint

-- The owner replies publicly, once, to a published review of their aircraft (RAT-5).
-- Errors: not_found, already_replied, reply_required.
CREATE OR REPLACE FUNCTION public.reply_to_review(target uuid, reply text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.reviews%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.reviews
  WHERE id = target AND direction = 'pilot_to_owner' AND subject_user_id = app.current_user_id()
    AND published_at IS NOT NULL AND hidden_at IS NULL;
  IF NOT FOUND OR app.current_user_id() IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF r.reply IS NOT NULL THEN
    RAISE EXCEPTION 'already_replied';
  END IF;
  IF char_length(btrim(coalesce(reply, ''))) = 0 THEN
    RAISE EXCEPTION 'reply_required';
  END IF;
  UPDATE public.reviews SET reply = left(btrim(reply_to_review.reply), 1000), replied_at = now()
  WHERE id = target;
  INSERT INTO public.booking_events (booking_id, actor_id, type)
  VALUES (r.booking_id, app.current_user_id(), 'review_replied');
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reply_to_review(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.reply_to_review(uuid, text) TO app_user;
