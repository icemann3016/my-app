-- M6 instant booking (BKG-4). The owner switches it on in the rental requirements; request_booking()
-- then accepts at once when no checkout flight is pending and the pilot has flown the
-- aircraft before (a completed booking). Recorded as one 'instant_booked' event.

GRANT UPDATE (instant_booking) ON public.rental_requirements TO app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.request_booking(
  target uuid,
  wanted tstzrange,
  departure text,
  arrival text,
  stops text[],
  purpose public.booking_purpose,
  passengers integer,
  planned_hours numeric,
  message text,
  estimate numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  plane public.aircraft%ROWTYPE;
  fields text[] := ARRAY[departure] || coalesce(stops, '{}') || ARRAY[arrival];
  failed text;
  new_id uuid;
  instant boolean;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_logged_in' USING ERRCODE = '42501';
  END IF;
  PERFORM public.expire_booking_requests();
  SELECT * INTO plane FROM public.aircraft WHERE id = target;
  IF NOT FOUND OR plane.status <> 'listed' OR plane.price_per_hour IS NULL THEN
    RAISE EXCEPTION 'aircraft_unavailable';
  END IF;
  IF wanted IS NULL OR isempty(wanted) OR lower(wanted) < now() THEN
    RAISE EXCEPTION 'period_in_past';
  END IF;
  IF upper(wanted) - lower(wanted) < interval '30 minutes'
     OR upper(wanted) - lower(wanted) > interval '14 days' THEN
    RAISE EXCEPTION 'period_length';
  END IF;
  IF passengers < 0 OR passengers > plane.seats - 1 THEN
    RAISE EXCEPTION 'too_many_passengers' USING DETAIL = (plane.seats - 1)::text;
  END IF;
  IF (SELECT count(*) FROM public.airports a WHERE a.ident = ANY (fields))
     < (SELECT count(DISTINCT f) FROM unnest(fields) f) THEN
    RAISE EXCEPTION 'unknown_airfield';
  END IF;
  SELECT string_agg(f.requirement, ',') INTO failed
  FROM public.eligibility_failures(me, target, wanted, fields) f WHERE f.blocking;
  IF failed IS NOT NULL THEN
    RAISE EXCEPTION 'not_eligible' USING DETAIL = failed;
  END IF;

  INSERT INTO public.bookings (
    aircraft_id, pilot_id, owner_id, period, departure_ident, arrival_ident, stops, purpose,
    passengers, planned_hours, message, price_per_hour, currency, price_basis, time_basis,
    estimate, checkout_required, expires_at)
  VALUES (
    target, me, plane.owner_id, wanted, departure, arrival, coalesce(stops, '{}'), purpose,
    passengers, planned_hours, nullif(btrim(message), ''), plane.price_per_hour, plane.currency,
    plane.price_basis, plane.time_basis, estimate,
    EXISTS (SELECT 1 FROM public.eligibility_failures(me, target, wanted, fields) f
            WHERE f.requirement = 'checkout'),
    least(now() + interval '24 hours', lower(wanted)))
  RETURNING id INTO new_id;
  -- Holds the time; a clash with another entry raises exclusion_violation (23P01).
  INSERT INTO public.calendar_entries (aircraft_id, period, kind, booking_id, created_by)
  VALUES (target, wanted, 'booking', new_id, me);
  -- Instant booking (BKG-4): the owner allows it, no checkout flight is pending, and the pilot
  -- has completed a rental of it before.
  instant := EXISTS (SELECT 1 FROM public.rental_requirements r
                     WHERE r.aircraft_id = target AND r.instant_booking)
    -- Blocking failures were refused above; of the conditions, a checkout flight is for the
    -- owner to arrange (a night flight is only a note to the pilot).
    AND NOT EXISTS (SELECT 1 FROM public.eligibility_failures(me, target, wanted, fields) f
                    WHERE f.requirement = 'checkout')
    AND EXISTS (SELECT 1 FROM public.bookings b
                WHERE b.aircraft_id = target AND b.pilot_id = me AND b.status = 'completed');
  IF instant THEN
    UPDATE public.bookings SET status = 'accepted', responded_at = now() WHERE id = new_id;
    INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
    VALUES (new_id, me, 'instant_booked', jsonb_build_object('estimate', estimate));
  ELSE
    INSERT INTO public.booking_events (booking_id, actor_id, type, payload)
    VALUES (new_id, me, 'requested', jsonb_build_object('estimate', estimate));
  END IF;
  RETURN new_id;
END;
$$;
