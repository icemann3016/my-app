-- Bookings keep the aircraft's full price terms from the time of the request (policy, weekend
-- price, daily minimum), so the amount due after the flight uses what was agreed.
CREATE OR REPLACE FUNCTION public.booking_copy_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  SELECT a.cancellation_policy, a.weekend_price_per_hour, a.min_hours_per_day
  INTO NEW.cancellation_policy, NEW.weekend_price_per_hour, NEW.min_hours_per_day
  FROM public.aircraft a WHERE a.id = NEW.aircraft_id;
  RETURN NEW;
END;
$$;
