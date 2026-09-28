-- MSG-2: contact details are shared only once a booking is accepted. The user edits their own
-- phone number (user_settings stays private); booking_contacts() gives each side of an accepted,
-- running or completed booking the other side's email and phone.

GRANT UPDATE (phone) ON public.user_settings TO app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.booking_contacts(target uuid)
RETURNS TABLE (user_id uuid, name text, email text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, p.display_name, u.email, s.phone
  FROM public.bookings b
  JOIN public.users u
    ON u.id = CASE WHEN b.pilot_id = app.current_user_id() THEN b.owner_id ELSE b.pilot_id END
  JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_settings s ON s.user_id = u.id
  WHERE b.id = target
    AND app.current_user_id() IN (b.pilot_id, b.owner_id)
    AND b.status IN ('accepted', 'in_progress', 'completed')
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.booking_contacts(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.booking_contacts(uuid) TO app_user;
