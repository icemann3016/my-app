-- M4 security: aircraft listings, photos, verified documents, reference files, rental requirements.
-- Owners manage their own aircraft; the public sees listed aircraft only; admins see everything.
-- Document verification (status) is done by trusted admin code with the owner connection.

-- Helpers --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_aircraft_owner(check_aircraft uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.aircraft
    WHERE id = check_aircraft AND owner_id = app.current_user_id()
  )
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_aircraft_owner(uuid) TO app_user;
--> statement-breakpoint

-- What still stops an aircraft from being listed (empty array = ready).
-- Codes: manufacturer, model, icao_type, seats, fuel_type, home_airport, price, photo, cofa, arc,
-- insurance. Runs with the caller's rights: owners see their own documents, admins and the
-- daily job see everything.
CREATE OR REPLACE FUNCTION public.aircraft_listing_problems(a public.aircraft)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  problems text[] := '{}';
  today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF a.manufacturer IS NULL OR btrim(a.manufacturer) = '' THEN problems := array_append(problems, 'manufacturer'); END IF;
  IF a.model IS NULL OR btrim(a.model) = '' THEN problems := array_append(problems, 'model'); END IF;
  IF a.icao_type IS NULL THEN problems := array_append(problems, 'icao_type'); END IF;
  IF a.seats IS NULL THEN problems := array_append(problems, 'seats'); END IF;
  IF a.fuel_type IS NULL THEN problems := array_append(problems, 'fuel_type'); END IF;
  IF a.home_airport_ident IS NULL THEN problems := array_append(problems, 'home_airport'); END IF;
  IF a.price_per_hour IS NULL THEN problems := array_append(problems, 'price'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.aircraft_photos p WHERE p.aircraft_id = a.id) THEN
    problems := array_append(problems, 'photo');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.aircraft_documents d
    WHERE d.aircraft_id = a.id AND d.kind = 'cofa' AND d.status = 'verified'
  ) THEN
    problems := array_append(problems, 'cofa');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.aircraft_documents d
    WHERE d.aircraft_id = a.id AND d.kind = 'arc' AND d.status = 'verified' AND d.expires_on >= today
  ) THEN
    problems := array_append(problems, 'arc');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.aircraft_documents d
    WHERE d.aircraft_id = a.id AND d.kind = 'insurance' AND d.status = 'verified'
      AND d.expires_on >= today
  ) THEN
    problems := array_append(problems, 'insurance');
  END IF;
  RETURN problems;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.aircraft_listing_problems(public.aircraft) TO app_user;
--> statement-breakpoint

-- Status rules -------------------------------------------------------------------
-- * Going to "listed" requires a complete listing with verified, unexpired documents.
-- * The registration can't change once the aircraft has left draft (documents are verified
--   against it).
-- * A system reason (e.g. documents_expired) is cleared when the status changes again.
CREATE OR REPLACE FUNCTION public.aircraft_status_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  problems text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.registration IS DISTINCT FROM OLD.registration AND OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'The registration can''t change after publishing'
        USING ERRCODE = 'P0001', HINT = 'registration_locked';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status_reason IS NOT DISTINCT FROM OLD.status_reason THEN
      NEW.status_reason := NULL;
    END IF;
  END IF;
  IF NEW.status = 'listed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'listed') THEN
    problems := public.aircraft_listing_problems(NEW);
    IF cardinality(problems) > 0 THEN
      RAISE EXCEPTION 'The aircraft can''t be listed yet: %', array_to_string(problems, ', ')
        USING ERRCODE = 'P0001', HINT = 'not_listable';
    END IF;
    NEW.listed_at := now();
    NEW.publish_requested_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER aircraft_status_rules BEFORE INSERT OR UPDATE ON public.aircraft
  FOR EACH ROW EXECUTE FUNCTION public.aircraft_status_rules();
--> statement-breakpoint
CREATE TRIGGER aircraft_set_updated_at BEFORE UPDATE ON public.aircraft
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER rental_requirements_set_updated_at BEFORE UPDATE ON public.rental_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
-- Aircraft documents follow the same review rules as pilot credentials (0006).
CREATE TRIGGER aircraft_documents_reset_review BEFORE UPDATE ON public.aircraft_documents
  FOR EACH ROW EXECUTE FUNCTION public.reset_review_on_change();
--> statement-breakpoint
CREATE TRIGGER aircraft_documents_timestamps BEFORE INSERT OR UPDATE ON public.aircraft_documents
  FOR EACH ROW EXECUTE FUNCTION public.credential_timestamps();
--> statement-breakpoint

-- At most 20 photos per aircraft (LST-3).
CREATE OR REPLACE FUNCTION public.aircraft_photos_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.aircraft WHERE id = NEW.aircraft_id FOR UPDATE;
  IF (SELECT count(*) FROM public.aircraft_photos WHERE aircraft_id = NEW.aircraft_id) >= 20 THEN
    RAISE EXCEPTION 'An aircraft can have at most 20 photos'
      USING ERRCODE = 'P0001', HINT = 'too_many_photos';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER aircraft_photos_limit BEFORE INSERT ON public.aircraft_photos
  FOR EACH ROW EXECUTE FUNCTION public.aircraft_photos_limit();
--> statement-breakpoint

-- aircraft ---------------------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON public.aircraft TO app_user;
--> statement-breakpoint
-- Owners may change the listing, not the owner, ratings or system fields.
GRANT UPDATE (registration, manufacturer, model, icao_type, year, category, seats, engine,
  fuel_type, fuel_burn_lph, cruise_kt, useful_load_kg, endurance_h, oil_unit, avionics, autopilot,
  transponder, adsb_out, night_vfr, ifr, equipment_notes, description, home_airport_ident,
  price_per_hour, weekend_price_per_hour, currency, price_basis, time_basis, min_hours_per_day,
  free_cancellation_hours, cancellation_note, status, publish_requested_at)
  ON public.aircraft TO app_user;
--> statement-breakpoint
CREATE POLICY aircraft_select ON public.aircraft FOR SELECT TO app_user
  USING (status = 'listed' OR owner_id = app.current_user_id() OR public.user_has_role('admin'));
--> statement-breakpoint
CREATE POLICY aircraft_insert ON public.aircraft FOR INSERT TO app_user
  WITH CHECK (owner_id = app.current_user_id() AND public.user_has_role('owner')
    AND status = 'draft' AND status_reason IS NULL AND listed_at IS NULL
    AND publish_requested_at IS NULL AND rating_avg IS NULL AND rating_count = 0);
--> statement-breakpoint
CREATE POLICY aircraft_update ON public.aircraft FOR UPDATE TO app_user
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY aircraft_delete ON public.aircraft FOR DELETE TO app_user
  USING (owner_id = app.current_user_id() AND status IN ('draft', 'paused', 'unlisted'));
--> statement-breakpoint

-- aircraft_photos: public with the aircraft; the owner adds, reorders and removes ---------
GRANT SELECT, INSERT, DELETE ON public.aircraft_photos TO app_user;
--> statement-breakpoint
GRANT UPDATE (sort_order) ON public.aircraft_photos TO app_user;
--> statement-breakpoint
CREATE POLICY aircraft_photos_select ON public.aircraft_photos FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_id));
--> statement-breakpoint
CREATE POLICY aircraft_photos_insert ON public.aircraft_photos FOR INSERT TO app_user
  WITH CHECK (public.is_aircraft_owner(aircraft_id)
    AND storage_key LIKE 'aircraft/' || aircraft_id::text || '/%');
--> statement-breakpoint
CREATE POLICY aircraft_photos_update ON public.aircraft_photos FOR UPDATE TO app_user
  USING (public.is_aircraft_owner(aircraft_id)) WITH CHECK (public.is_aircraft_owner(aircraft_id));
--> statement-breakpoint
CREATE POLICY aircraft_photos_delete ON public.aircraft_photos FOR DELETE TO app_user
  USING (public.is_aircraft_owner(aircraft_id));
--> statement-breakpoint

-- aircraft_documents: owner and admins; new rows start pending -------------------------
GRANT SELECT, INSERT, DELETE ON public.aircraft_documents TO app_user;
--> statement-breakpoint
GRANT UPDATE (expires_on, document_id) ON public.aircraft_documents TO app_user;
--> statement-breakpoint
CREATE POLICY aircraft_documents_select ON public.aircraft_documents FOR SELECT TO app_user
  USING (public.is_aircraft_owner(aircraft_id) OR public.user_has_role('admin'));
--> statement-breakpoint
CREATE POLICY aircraft_documents_insert ON public.aircraft_documents FOR INSERT TO app_user
  WITH CHECK (public.is_aircraft_owner(aircraft_id)
    AND status = 'pending' AND rejection_reason IS NULL AND reviewed_by IS NULL
    AND reviewed_at IS NULL AND reminder_sent_at IS NULL
    AND (document_id IS NULL OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = app.current_user_id())));
--> statement-breakpoint
CREATE POLICY aircraft_documents_update ON public.aircraft_documents FOR UPDATE TO app_user
  USING (public.is_aircraft_owner(aircraft_id))
  WITH CHECK (public.is_aircraft_owner(aircraft_id)
    AND (document_id IS NULL OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = app.current_user_id())));
--> statement-breakpoint
CREATE POLICY aircraft_documents_delete ON public.aircraft_documents FOR DELETE TO app_user
  USING (public.is_aircraft_owner(aircraft_id));
--> statement-breakpoint

-- aircraft_files (POH, checklists, W&B): owner and admins for now; renters with an accepted
-- booking get access in M6 ------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON public.aircraft_files TO app_user;
--> statement-breakpoint
GRANT UPDATE (kind, title) ON public.aircraft_files TO app_user;
--> statement-breakpoint
CREATE POLICY aircraft_files_select ON public.aircraft_files FOR SELECT TO app_user
  USING (public.is_aircraft_owner(aircraft_id) OR public.user_has_role('admin'));
--> statement-breakpoint
CREATE POLICY aircraft_files_insert ON public.aircraft_files FOR INSERT TO app_user
  WITH CHECK (public.is_aircraft_owner(aircraft_id) AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_id AND d.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY aircraft_files_update ON public.aircraft_files FOR UPDATE TO app_user
  USING (public.is_aircraft_owner(aircraft_id)) WITH CHECK (public.is_aircraft_owner(aircraft_id));
--> statement-breakpoint
CREATE POLICY aircraft_files_delete ON public.aircraft_files FOR DELETE TO app_user
  USING (public.is_aircraft_owner(aircraft_id));
--> statement-breakpoint

-- rental_requirements: public with the aircraft; the owner edits ------------------------
GRANT SELECT, INSERT, DELETE ON public.rental_requirements TO app_user;
--> statement-breakpoint
GRANT UPDATE (min_pilot_rating, min_reviews, unrated_policy, licence_types, required_ratings,
  min_total_hours, min_type_hours, min_90_day_hours, min_age)
  ON public.rental_requirements TO app_user;
--> statement-breakpoint
CREATE POLICY rental_requirements_select ON public.rental_requirements FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_id));
--> statement-breakpoint
CREATE POLICY rental_requirements_insert ON public.rental_requirements FOR INSERT TO app_user
  WITH CHECK (public.is_aircraft_owner(aircraft_id));
--> statement-breakpoint
CREATE POLICY rental_requirements_update ON public.rental_requirements FOR UPDATE TO app_user
  USING (public.is_aircraft_owner(aircraft_id)) WITH CHECK (public.is_aircraft_owner(aircraft_id));
--> statement-breakpoint
CREATE POLICY rental_requirements_delete ON public.rental_requirements FOR DELETE TO app_user
  USING (public.is_aircraft_owner(aircraft_id));
