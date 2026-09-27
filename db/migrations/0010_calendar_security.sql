-- M5: no double bookings, calendar privacy and availability helpers (plan §4.1).
-- btree_gist lets the exclusion constraint combine "same aircraft" (=) with "overlapping time"
-- (&&). It ships with PostgreSQL and is available on Supabase, Cloud SQL and Azure.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- Two active entries of the same aircraft can never overlap, even if two pilots book at once.
ALTER TABLE public.calendar_entries ADD CONSTRAINT calendar_entries_no_overlap
  EXCLUDE USING gist (aircraft_id WITH =, period WITH &&) WHERE (active);
--> statement-breakpoint

-- New entries get fresh timestamps and their author (users can't pick them).
CREATE OR REPLACE FUNCTION public.calendar_entry_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.created_at := now();
  NEW.created_by := coalesce(app.current_user_id(), NEW.created_by);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER calendar_entries_defaults BEFORE INSERT ON public.calendar_entries
  FOR EACH ROW EXECUTE FUNCTION public.calendar_entry_defaults();
--> statement-breakpoint

-- Owners see and manage their aircraft's calendar; admins see all of it. Booking entries are
-- created and released by the booking functions (M6), never directly by users. Pilots only see
-- when an aircraft is busy, through aircraft_busy_periods() below (no notes, no kinds).
GRANT SELECT, INSERT, DELETE ON public.calendar_entries TO app_user;
--> statement-breakpoint
CREATE POLICY calendar_entries_select ON public.calendar_entries FOR SELECT TO app_user
  USING (public.user_has_role('admin') OR EXISTS (
    SELECT 1 FROM public.aircraft a
    WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY calendar_entries_insert ON public.calendar_entries FOR INSERT TO app_user
  WITH CHECK (kind <> 'booking' AND booking_id IS NULL AND active
    AND EXISTS (SELECT 1 FROM public.aircraft a
                WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY calendar_entries_delete ON public.calendar_entries FOR DELETE TO app_user
  USING (kind <> 'booking' AND EXISTS (
    SELECT 1 FROM public.aircraft a
    WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint

-- Whether the caller may see an aircraft at all (same rule as the aircraft_select policy).
CREATE OR REPLACE FUNCTION public.aircraft_visible(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.aircraft a
    WHERE a.id = target
      AND (a.status = 'listed' OR a.owner_id = app.current_user_id()
           OR public.user_has_role('admin')))
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.aircraft_visible(uuid) FROM PUBLIC;
--> statement-breakpoint

-- When a visible aircraft is busy within a window (at most ~13 months): periods only.
CREATE OR REPLACE FUNCTION public.aircraft_busy_periods(target uuid, time_window tstzrange)
RETURNS TABLE (period tstzrange)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.period
  FROM public.calendar_entries c
  WHERE c.aircraft_id = target AND c.active AND c.period && time_window
    AND upper(time_window) - lower(time_window) <= interval '400 days'
    AND public.aircraft_visible(target)
  ORDER BY lower(c.period)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.aircraft_busy_periods(uuid, tstzrange) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.aircraft_busy_periods(uuid, tstzrange) TO app_user;
--> statement-breakpoint

-- Whether a visible aircraft is free for the whole period (search, booking requests).
CREATE OR REPLACE FUNCTION public.aircraft_is_free(target uuid, wanted tstzrange)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.aircraft_visible(target) AND NOT EXISTS (
    SELECT 1 FROM public.calendar_entries c
    WHERE c.aircraft_id = target AND c.active AND c.period && wanted)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.aircraft_is_free(uuid, tstzrange) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.aircraft_is_free(uuid, tstzrange) TO app_user;
