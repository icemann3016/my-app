-- M9 moderation (ADM-2). Admins act with the owner connection after requireAdmin() and log to
-- admin_actions (lib/admin/moderation.ts). The database makes the actions stick:
-- - an aircraft unlisted by an admin (unlisted_reason 'admin') or because its owner was suspended
--   ('suspended') can't be listed again by the owner until an admin clears the reason;
-- - suspended users can't send messages or write reviews (logging in is refused by the app and
--   their sessions are deleted; booking requests already fail eligibility).

CREATE OR REPLACE FUNCTION public.check_aircraft_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  gaps text[];
BEGIN
  IF NEW.status = 'draft' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'aircraft_cannot_return_to_draft' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'listed' AND OLD.status <> 'listed' THEN
    IF OLD.unlisted_reason IN ('admin', 'suspended')
       OR EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = NEW.owner_id AND p.suspended_at IS NOT NULL) THEN
      RAISE EXCEPTION 'aircraft_blocked' USING ERRCODE = 'check_violation';
    END IF;
    gaps := public.aircraft_listing_gaps(NEW.id);
    IF cardinality(gaps) > 0 THEN
      RAISE EXCEPTION 'aircraft_not_listable'
        USING ERRCODE = 'check_violation', DETAIL = array_to_string(gaps, ',');
    END IF;
    NEW.unlisted_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refuse_suspended_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  author uuid := (to_jsonb(NEW) ->> CASE TG_TABLE_NAME WHEN 'messages' THEN 'sender_id'
                                                        ELSE 'author_id' END)::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = author AND p.suspended_at IS NOT NULL)
  THEN
    RAISE EXCEPTION 'suspended';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER messages_refuse_suspended BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.refuse_suspended_author();
--> statement-breakpoint
CREATE TRIGGER reviews_refuse_suspended BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refuse_suspended_author();
