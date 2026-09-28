-- M8 messages (MSG-1). A conversation is about a booking (its pilot and owner) or, before any
-- booking, an enquiry about a listed aircraft (the person asking and the owner). Only the two
-- participants read it; messages are written through functions. Admins see a message only when it
-- is reported (lib/admin, owner connection after requireAdmin()).

GRANT SELECT ON public.conversations TO app_user;
--> statement-breakpoint
GRANT SELECT ON public.messages TO app_user;
--> statement-breakpoint
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO app_user
  USING (owner_id = app.current_user_id() OR pilot_id = app.current_user_id());
--> statement-breakpoint
-- The subquery on conversations is itself filtered by RLS: participants only.
CREATE POLICY messages_select ON public.messages FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id));
--> statement-breakpoint

-- Send a message in a conversation the user takes part in. Returns the message id.
-- Errors: not_found, body_required.
CREATE OR REPLACE FUNCTION public.send_message(target uuid, body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  c public.conversations%ROWTYPE;
  message_id uuid;
BEGIN
  SELECT * INTO c FROM public.conversations WHERE id = target;
  IF me IS NULL OR NOT FOUND OR me NOT IN (c.owner_id, coalesce(c.pilot_id, c.owner_id))
     OR c.pilot_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF char_length(btrim(coalesce(body, ''))) = 0 THEN
    RAISE EXCEPTION 'body_required';
  END IF;
  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (target, me, left(btrim(body), 4000))
  RETURNING id INTO message_id;
  UPDATE public.conversations SET
    last_message_at = now(),
    owner_read_at = CASE WHEN me = owner_id THEN now() ELSE owner_read_at END,
    pilot_read_at = CASE WHEN me = pilot_id THEN now() ELSE pilot_read_at END
  WHERE id = target;
  RETURN message_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.send_message(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO app_user;
--> statement-breakpoint

-- Open (or find) the conversation about a booking the user is part of, or, without a booking,
-- an enquiry about a listed aircraft that isn't theirs; then send the first message when given.
-- Returns the conversation id. Errors: not_found, body_required.
CREATE OR REPLACE FUNCTION public.start_conversation(
  target_aircraft uuid, target_booking uuid, body text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := app.current_user_id();
  b public.bookings%ROWTYPE;
  a public.aircraft%ROWTYPE;
  conv uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF target_booking IS NOT NULL THEN
    SELECT * INTO b FROM public.bookings WHERE id = target_booking;
    IF NOT FOUND OR b.pilot_id IS NULL OR me NOT IN (b.pilot_id, b.owner_id) THEN
      RAISE EXCEPTION 'not_found';
    END IF;
    INSERT INTO public.conversations (aircraft_id, booking_id, owner_id, pilot_id)
    VALUES (b.aircraft_id, b.id, b.owner_id, b.pilot_id)
    ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO NOTHING;
    SELECT id INTO conv FROM public.conversations WHERE booking_id = b.id;
  ELSE
    SELECT * INTO a FROM public.aircraft WHERE id = target_aircraft;
    IF NOT FOUND OR a.owner_id = me THEN
      RAISE EXCEPTION 'not_found';
    END IF;
    SELECT id INTO conv FROM public.conversations
    WHERE aircraft_id = a.id AND pilot_id = me AND booking_id IS NULL;
    IF conv IS NULL THEN
      -- New enquiries only about listed aircraft.
      IF a.status <> 'listed' THEN
        RAISE EXCEPTION 'not_found';
      END IF;
      INSERT INTO public.conversations (aircraft_id, owner_id, pilot_id)
      VALUES (a.id, a.owner_id, me)
      ON CONFLICT (aircraft_id, pilot_id) WHERE booking_id IS NULL DO NOTHING;
      SELECT id INTO conv FROM public.conversations
      WHERE aircraft_id = a.id AND pilot_id = me AND booking_id IS NULL;
    END IF;
  END IF;
  IF body IS NOT NULL THEN
    PERFORM public.send_message(conv, body);
  END IF;
  RETURN conv;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.start_conversation(uuid, uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid, uuid, text) TO app_user;
--> statement-breakpoint

-- Mark a conversation as read by the current user.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(target uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.conversations SET
    owner_read_at = CASE WHEN owner_id = app.current_user_id() THEN now() ELSE owner_read_at END,
    pilot_read_at = CASE WHEN pilot_id = app.current_user_id() THEN now() ELSE pilot_read_at END
  WHERE id = target AND app.current_user_id() IN (owner_id, pilot_id)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO app_user;
--> statement-breakpoint

-- Messages can be reported by the participants (ADM-3).
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
    WHEN 'message' THEN EXISTS (SELECT 1 FROM public.messages WHERE id = target)
    ELSE false END;
END;
$$;
