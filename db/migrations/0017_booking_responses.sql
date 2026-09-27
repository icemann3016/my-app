-- M6: the owner answers a booking request (BKG-3, BKG-5). Accepting keeps the calendar hold;
-- declining (optionally with another time to suggest) frees it. Only the aircraft's owner can
-- answer, only while the request is open, and the pilot must still meet the requirements.
CREATE OR REPLACE FUNCTION public.respond_to_booking(
  target uuid, decision text, note text DEFAULT NULL, proposal tstzrange DEFAULT NULL)
RETURNS public.booking_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  b public.bookings%ROWTYPE;
  fields text[];
BEGIN
  PERFORM public.expire_booking_requests();
  SELECT * INTO b FROM public.bookings WHERE id = target FOR UPDATE;
  IF NOT FOUND OR b.owner_id IS DISTINCT FROM me THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF b.status <> 'requested' THEN
    RAISE EXCEPTION 'not_open' USING DETAIL = b.status::text;
  END IF;
  IF decision NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'bad_decision';
  END IF;

  IF decision = 'accept' THEN
    fields := ARRAY[b.departure_ident] || b.stops || ARRAY[b.arrival_ident];
    IF b.pilot_id IS NULL OR EXISTS (
      SELECT 1 FROM public.eligibility_failures(b.pilot_id, b.aircraft_id, b.period, fields) f
      WHERE f.blocking) THEN
      RAISE EXCEPTION 'pilot_not_eligible';
    END IF;
    UPDATE public.bookings
    SET status = 'accepted', responded_at = now(), owner_note = nullif(btrim(note), '')
    WHERE id = target;
    INSERT INTO public.booking_events (booking_id, actor_id, type) VALUES (target, me, 'accepted');
    RETURN 'accepted';
  END IF;

  IF proposal IS NOT NULL AND (isempty(proposal) OR lower(proposal) < now()) THEN
    RAISE EXCEPTION 'bad_proposal';
  END IF;
  UPDATE public.bookings
  SET status = 'declined', responded_at = now(), owner_note = nullif(btrim(note), ''),
      proposed_period = proposal
  WHERE id = target;
  UPDATE public.calendar_entries SET active = false WHERE booking_id = target;
  INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
  VALUES (target, me, CASE WHEN proposal IS NULL THEN 'declined' ELSE 'proposed' END,
    CASE WHEN proposal IS NULL THEN NULL
         ELSE jsonb_build_object('from', lower(proposal), 'to', upper(proposal)) END);
  RETURN 'declined';
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.respond_to_booking(uuid, text, text, tstzrange) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.respond_to_booking(uuid, text, text, tstzrange) TO app_user;
