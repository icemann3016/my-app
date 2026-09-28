-- M6 notifications (BKG-9). Everyone sees and marks as read only their own. Rows are made by the
-- database: every booking event notifies the other party (pilot and owner minus whoever acted, so
-- both when the system acted, e.g. an expired request); the daily job adds 24-hour reminders.

GRANT SELECT ON public.notifications TO app_user;
--> statement-breakpoint
GRANT UPDATE (read_at) ON public.notifications TO app_user;
--> statement-breakpoint
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO app_user
  USING (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.notify_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  b public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, booking_id, actor_id, emailed_at)
  SELECT person, NEW.type, NEW.booking_id, NEW.actor_id,
         -- Defects already get their own detailed email (lib/bookings/defects.ts).
         CASE WHEN NEW.type = 'defect_reported' THEN now() END
  FROM unnest(ARRAY[b.pilot_id, b.owner_id]) AS person
  WHERE person IS NOT NULL AND person IS DISTINCT FROM NEW.actor_id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER booking_events_notify AFTER INSERT ON public.booking_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_event();
--> statement-breakpoint

-- Daily job (owner connection): remind pilot and owner of accepted bookings starting within the
-- next 36 hours, once per booking. Returns how many bookings were reminded.
CREATE OR REPLACE FUNCTION public.create_booking_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  WITH due AS (
    UPDATE public.bookings SET reminder_sent_at = now()
    WHERE status = 'accepted' AND reminder_sent_at IS NULL
      AND lower(period) > now() AND lower(period) <= now() + interval '36 hours'
    RETURNING id, pilot_id, owner_id
  ), made AS (
    INSERT INTO public.notifications (user_id, type, booking_id)
    SELECT person, 'reminder', due.id
    FROM due, unnest(ARRAY[due.pilot_id, due.owner_id]) AS person
    WHERE person IS NOT NULL
    RETURNING booking_id
  )
  SELECT count(DISTINCT booking_id) INTO n FROM made;
  RETURN n;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_booking_reminders() FROM PUBLIC;
