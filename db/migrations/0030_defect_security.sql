-- M6 defects and grounding (BKG-8). The reporter, the aircraft's owner and admins see a defect.
-- Reports and resolutions go through functions; a grounded aircraft can't be booked, accepted or
-- checked out until the owner lists it again.

CREATE POLICY defects_select ON public.defects FOR SELECT TO app_user
  USING (reported_by = app.current_user_id()
    OR public.user_has_role('admin')
    OR EXISTS (SELECT 1 FROM public.aircraft a
               WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
GRANT SELECT ON public.defects TO app_user;
--> statement-breakpoint

-- Report a defect: the aircraft's owner (booking null), or the pilot of an accepted, running or
-- completed booking of it. The photo must be the reporter's own document. Returns the defect id.
-- Errors: not_found, description_required, bad_photo.
CREATE OR REPLACE FUNCTION public.report_defect(
  target_aircraft uuid, target_booking uuid, severity public.defect_severity, description text,
  photo uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  allowed boolean;
  defect_id uuid;
BEGIN
  IF target_booking IS NULL THEN
    allowed := EXISTS (SELECT 1 FROM public.aircraft a
                       WHERE a.id = target_aircraft AND a.owner_id = me);
  ELSE
    allowed := EXISTS (SELECT 1 FROM public.bookings b
                       WHERE b.id = target_booking AND b.aircraft_id = target_aircraft
                         AND (b.pilot_id = me OR b.owner_id = me)
                         AND b.status IN ('accepted', 'in_progress', 'completed'));
  END IF;
  IF me IS NULL OR NOT allowed THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF char_length(btrim(coalesce(description, ''))) = 0 THEN
    RAISE EXCEPTION 'description_required';
  END IF;
  IF photo IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.documents d WHERE d.id = photo AND d.owner_id = me) THEN
    RAISE EXCEPTION 'bad_photo';
  END IF;
  INSERT INTO public.defects (aircraft_id, booking_id, reported_by, severity, description, photo_id)
  VALUES (target_aircraft, target_booking, me, severity, left(btrim(description), 2000), photo)
  RETURNING id INTO defect_id;
  IF target_booking IS NOT NULL THEN
    INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
    VALUES (target_booking, me, 'defect_reported', jsonb_build_object('severity', severity));
  END IF;
  RETURN defect_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.report_defect(uuid, uuid, public.defect_severity, text, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.report_defect(uuid, uuid, public.defect_severity, text, uuid) TO app_user;
--> statement-breakpoint

-- The aircraft's owner marks a defect as fixed, with a note. Errors: not_found, already_resolved.
CREATE OR REPLACE FUNCTION public.resolve_defect(target uuid, note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.defects d JOIN public.aircraft a ON a.id = d.aircraft_id
                 WHERE d.id = target AND a.owner_id = app.current_user_id()) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  UPDATE public.defects
  SET resolved_at = now(), resolved_by = app.current_user_id(),
      resolution = nullif(left(btrim(coalesce(note, '')), 1000), '')
  WHERE id = target AND resolved_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'already_resolved';
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.resolve_defect(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_defect(uuid, text) TO app_user;
--> statement-breakpoint

-- The owner may open the photo of a defect on their aircraft (the reporter owns the file).
CREATE OR REPLACE FUNCTION public.defect_document_visible(doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.defects d JOIN public.aircraft a ON a.id = d.aircraft_id
    WHERE d.photo_id = doc_id AND a.owner_id = app.current_user_id())
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.defect_document_visible(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.defect_document_visible(uuid) TO app_user;
--> statement-breakpoint
CREATE POLICY documents_select_defect ON public.documents FOR SELECT TO app_user
  USING (public.defect_document_visible(id));
--> statement-breakpoint

-- Grounded means grounded: no booking of it is accepted or checked out until it's listed again.
CREATE OR REPLACE FUNCTION public.bookings_check_grounded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('accepted', 'in_progress') AND NEW.status IS DISTINCT FROM OLD.status
     AND EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = NEW.aircraft_id AND a.status = 'grounded') THEN
    RAISE EXCEPTION 'aircraft_grounded';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bookings_check_grounded BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_check_grounded();
