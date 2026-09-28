-- Spam limits (security review, KAN-69): at most 30 messages per sender in 10 minutes and
-- 20 reports per reporter a day. Checked on insert; errors: too_many_messages, too_many_reports.

CREATE OR REPLACE FUNCTION public.limit_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.messages m
      WHERE m.sender_id = NEW.sender_id AND m.created_at > now() - interval '10 minutes') >= 30 THEN
    RAISE EXCEPTION 'too_many_messages';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER messages_limit BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.limit_messages();
--> statement-breakpoint
CREATE INDEX messages_sender_idx ON public.messages (sender_id, created_at);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.limit_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.reports r
      WHERE r.reporter_id = NEW.reporter_id AND r.created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'too_many_reports';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER reports_limit BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.limit_reports();
