-- MSG-3: each user chooses email and/or in-app for booking and review notifications, and email
-- for messages (lib/messages/emails.ts). Defect emails and account emails are always sent.
-- A notification nobody wants on any channel isn't created at all.

GRANT UPDATE (email_bookings, in_app_bookings, email_reviews, in_app_reviews, email_messages)
  ON public.user_settings TO app_user;
--> statement-breakpoint

-- 'reviews' for review events, else 'bookings'.
CREATE OR REPLACE FUNCTION public.notification_kind(event_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN event_type IN ('review_submitted', 'reviews_published', 'review_replied')
    THEN 'reviews' ELSE 'bookings' END
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.notify_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  b public.bookings%ROWTYPE;
  kind text := public.notification_kind(NEW.type);
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, booking_id, actor_id, in_app, emailed_at)
  SELECT person, NEW.type, NEW.booking_id, NEW.actor_id, p.in_app,
         -- Defects already get their own detailed email (lib/bookings/defects.ts); an unwanted
         -- email is marked as done so it's never sent.
         CASE WHEN NEW.type = 'defect_reported' OR NOT p.email THEN now() END
  FROM unnest(ARRAY[b.pilot_id, b.owner_id]) AS person
  CROSS JOIN LATERAL (
    SELECT coalesce(CASE kind WHEN 'reviews' THEN s.email_reviews ELSE s.email_bookings END, true)
             AS email,
           coalesce(CASE kind WHEN 'reviews' THEN s.in_app_reviews ELSE s.in_app_bookings END, true)
             AS in_app
    FROM (SELECT 1) one
    LEFT JOIN public.user_settings s ON s.user_id = person) p
  WHERE person IS NOT NULL AND person IS DISTINCT FROM NEW.actor_id
    AND (p.email OR p.in_app OR NEW.type = 'defect_reported');
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Reminders follow the booking settings too.
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
    INSERT INTO public.notifications (user_id, type, booking_id, in_app, emailed_at)
    SELECT person, 'reminder', due.id, coalesce(s.in_app_bookings, true),
           CASE WHEN NOT coalesce(s.email_bookings, true) THEN now() END
    FROM due
    CROSS JOIN LATERAL unnest(ARRAY[due.pilot_id, due.owner_id]) AS person
    LEFT JOIN public.user_settings s ON s.user_id = person
    WHERE person IS NOT NULL
      AND (coalesce(s.in_app_bookings, true) OR coalesce(s.email_bookings, true))
    RETURNING booking_id
  )
  SELECT count(DISTINCT id) INTO n FROM due;
  RETURN n;
END;
$$;
