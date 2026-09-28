-- M6 remarks and PIREPs (BKG-15). The pilot adds remarks while the log is editable; the booking's
-- pilot and owner (and the aircraft's owner, for its history) see them. Only the aircraft's owner
-- marks an aircraft remark as a known item or as fixed, through set_known_item(). Renters see open
-- known items through known_items_for_aircraft(), without who wrote them.

-- The aircraft comes from the log's booking and the time from the clock, never from the client.
CREATE OR REPLACE FUNCTION public.flight_remarks_set_aircraft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT b.aircraft_id INTO NEW.aircraft_id
  FROM public.flight_logs l JOIN public.bookings b ON b.id = l.booking_id
  WHERE l.id = NEW.flight_log_id;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER flight_remarks_set_aircraft BEFORE INSERT ON public.flight_remarks
  FOR EACH ROW EXECUTE FUNCTION public.flight_remarks_set_aircraft();
--> statement-breakpoint

-- Inserts may name every column (the ORM does); the trigger sets the aircraft and time, and the
-- policy refuses known-item columns.
GRANT SELECT, INSERT, DELETE ON public.flight_remarks TO app_user;
--> statement-breakpoint
CREATE POLICY flight_remarks_select ON public.flight_remarks FOR SELECT TO app_user
  USING (public.flight_log_role(flight_log_id) IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.aircraft a
    WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY flight_remarks_insert ON public.flight_remarks FOR INSERT TO app_user
  WITH CHECK (public.flight_log_editable(flight_log_id) AND known_since IS NULL
    AND resolved_at IS NULL);
--> statement-breakpoint
CREATE POLICY flight_remarks_delete ON public.flight_remarks FOR DELETE TO app_user
  USING (public.flight_log_editable(flight_log_id) AND known_since IS NULL);
--> statement-breakpoint

-- The aircraft's owner marks an aircraft remark as a known item ('known') or as fixed
-- ('resolved'). Errors: not_found, not_aircraft, bad_state.
CREATE OR REPLACE FUNCTION public.set_known_item(target uuid, state text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.flight_remarks%ROWTYPE;
BEGIN
  SELECT fr.* INTO r FROM public.flight_remarks fr
  JOIN public.aircraft a ON a.id = fr.aircraft_id
  WHERE fr.id = target AND a.owner_id = app.current_user_id()
  FOR UPDATE OF fr;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF r.kind <> 'aircraft' THEN
    RAISE EXCEPTION 'not_aircraft';
  END IF;
  IF state = 'known' THEN
    UPDATE public.flight_remarks SET known_since = now(), resolved_at = NULL WHERE id = target;
  ELSIF state = 'resolved' AND r.known_since IS NOT NULL THEN
    UPDATE public.flight_remarks SET resolved_at = now() WHERE id = target;
  ELSE
    RAISE EXCEPTION 'bad_state';
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.set_known_item(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.set_known_item(uuid, text) TO app_user;
--> statement-breakpoint

-- Open known items of an aircraft, for its owner, admins and pilots with an open or upcoming
-- booking of it (requested, accepted or in progress). Empty for everyone else.
CREATE OR REPLACE FUNCTION public.known_items_for_aircraft(target uuid)
RETURNS TABLE (id uuid, body text, known_since timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT fr.id, fr.body, fr.known_since
  FROM public.flight_remarks fr
  WHERE fr.aircraft_id = target AND fr.known_since IS NOT NULL AND fr.resolved_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.aircraft a
              WHERE a.id = target AND a.owner_id = app.current_user_id())
      OR public.user_has_role('admin')
      OR EXISTS (SELECT 1 FROM public.bookings b
                 WHERE b.aircraft_id = target AND b.pilot_id = app.current_user_id()
                   AND b.status IN ('requested', 'accepted', 'in_progress')))
  ORDER BY fr.known_since
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.known_items_for_aircraft(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.known_items_for_aircraft(uuid) TO app_user;
