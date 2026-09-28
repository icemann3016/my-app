-- Calendar details for everyone who may see the aircraft: each busy period with its kind
-- (booking, own use, maintenance, unavailable) and, for bookings, whether it's only requested.
-- Never notes or who booked it; the owner reads calendar_entries directly for those.
CREATE OR REPLACE FUNCTION public.aircraft_calendar_view(target uuid, time_window tstzrange)
RETURNS TABLE (period tstzrange, kind public.calendar_entry_kind, pending boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.period, c.kind, coalesce(b.status = 'requested', false)
  FROM public.calendar_entries c
  LEFT JOIN public.bookings b ON b.id = c.booking_id
  WHERE c.aircraft_id = target AND c.active AND c.period && time_window
    AND upper(time_window) - lower(time_window) <= interval '400 days'
    AND public.aircraft_visible(target)
  ORDER BY lower(c.period)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.aircraft_calendar_view(uuid, tstzrange) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.aircraft_calendar_view(uuid, tstzrange) TO app_user;
