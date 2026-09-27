-- M4 security: aircraft, photos, documents and rental requirements.
-- Owners manage their own aircraft; everyone may read listed aircraft (and their photos and
-- requirements); admins read everything. CofA/ARC/insurance are verified by trusted admin code
-- with the owner connection, like pilot credentials (0006_pilot_security.sql).

-- Timestamps ------------------------------------------------------------------
CREATE TRIGGER aircraft_set_updated_at BEFORE UPDATE ON public.aircraft
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER rental_requirements_set_updated_at BEFORE UPDATE ON public.rental_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER aircraft_documents_timestamps BEFORE INSERT OR UPDATE ON public.aircraft_documents
  FOR EACH ROW EXECUTE FUNCTION public.credential_timestamps();
--> statement-breakpoint

-- Changing a verified document sends it back for review ------------------------
-- (reference documents such as the POH have no review status and are left alone).
CREATE OR REPLACE FUNCTION public.reset_aircraft_document_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  meta text[] := ARRAY['status', 'rejection_reason', 'reviewed_by', 'reviewed_at',
                       'reminder_sent_at', 'created_at', 'updated_at'];
BEGIN
  IF NEW.status IS NOT NULL
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND (to_jsonb(NEW) - meta) IS DISTINCT FROM (to_jsonb(OLD) - meta) THEN
    NEW.status := 'pending';
    NEW.rejection_reason := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.reminder_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER aircraft_documents_reset_review BEFORE UPDATE ON public.aircraft_documents
  FOR EACH ROW EXECUTE FUNCTION public.reset_aircraft_document_review();
--> statement-breakpoint

-- What an aircraft still needs before it can be listed (LST-3/4/5/6) ------------
-- Empty array = ready. Codes: home_base, price, photo, arc, insurance. A document counts when
-- an admin verified it and it hasn't expired; a renewed ARC is added as a new row, so the old
-- one keeps the aircraft listed until it expires. Runs with the caller's rights: owners and
-- admins see all of it, so only they get a meaningful answer.
CREATE OR REPLACE FUNCTION public.aircraft_listing_gaps(target uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN a.home_airport_ident IS NULL THEN 'home_base' END,
    CASE WHEN a.price_per_hour IS NULL THEN 'price' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.aircraft_photos p WHERE p.aircraft_id = a.id)
      THEN 'photo' END,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.aircraft_documents d
      WHERE d.aircraft_id = a.id AND d.kind = 'arc' AND d.status = 'verified'
        AND d.expires_on >= (now() AT TIME ZONE 'utc')::date) THEN 'arc' END,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.aircraft_documents d
      WHERE d.aircraft_id = a.id AND d.kind = 'insurance' AND d.status = 'verified'
        AND d.expires_on >= (now() AT TIME ZONE 'utc')::date) THEN 'insurance' END
  ], NULL)
  FROM public.aircraft a
  WHERE a.id = target
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.aircraft_listing_gaps(uuid) FROM PUBLIC;
--> statement-breakpoint

-- Status rules: an aircraft is listed only when it's ready, and never goes back to draft ----
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
CREATE TRIGGER aircraft_check_status BEFORE UPDATE OF status ON public.aircraft
  FOR EACH ROW EXECUTE FUNCTION public.check_aircraft_status();
--> statement-breakpoint

-- At most 20 photos per aircraft (LST-3) -----------------------------------------
CREATE OR REPLACE FUNCTION public.limit_aircraft_photos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Serialise uploads for the same aircraft so two at once can't both pass the count.
  PERFORM 1 FROM public.aircraft WHERE id = NEW.aircraft_id FOR UPDATE;
  IF (SELECT count(*) FROM public.aircraft_photos WHERE aircraft_id = NEW.aircraft_id) >= 20 THEN
    RAISE EXCEPTION 'too_many_photos' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER aircraft_photos_limit BEFORE INSERT ON public.aircraft_photos
  FOR EACH ROW EXECUTE FUNCTION public.limit_aircraft_photos();
--> statement-breakpoint

-- aircraft ------------------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON public.aircraft TO app_user;
--> statement-breakpoint
-- Owners change the listing, never the owner, ratings or the system's unlisting reason.
GRANT UPDATE (registration, manufacturer, model, type_designator, year, category, seats, engine,
  fuel_type, fuel_burn_lph, cruise_kt, useful_load_kg, endurance_h, avionics, autopilot,
  transponder, night_vfr, ifr, description, home_airport_ident, price_per_hour,
  weekend_price_per_hour, currency, price_basis, time_basis, min_hours_per_day, oil_unit,
  cancellation_policy, status) ON public.aircraft TO app_user;
--> statement-breakpoint
CREATE POLICY aircraft_select ON public.aircraft FOR SELECT TO app_user
  USING (status = 'listed' OR owner_id = app.current_user_id() OR public.user_has_role('admin'));
--> statement-breakpoint
-- New aircraft start as drafts of a user with the owner role.
CREATE POLICY aircraft_insert ON public.aircraft FOR INSERT TO app_user
  WITH CHECK (owner_id = app.current_user_id() AND public.user_has_role('owner')
    AND status = 'draft' AND unlisted_reason IS NULL
    AND rating_avg IS NULL AND rating_count = 0);
--> statement-breakpoint
CREATE POLICY aircraft_update ON public.aircraft FOR UPDATE TO app_user
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY aircraft_delete ON public.aircraft FOR DELETE TO app_user
  USING (owner_id = app.current_user_id());
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.aircraft_listing_gaps(uuid) TO app_user;
--> statement-breakpoint

-- aircraft_photos: visible with the aircraft; the owner manages them ----------------
GRANT SELECT, INSERT, DELETE ON public.aircraft_photos TO app_user;
--> statement-breakpoint
GRANT UPDATE (sort_order) ON public.aircraft_photos TO app_user;
--> statement-breakpoint
-- The subquery on aircraft is itself filtered by RLS: photos are visible when the aircraft is.
CREATE POLICY aircraft_photos_select ON public.aircraft_photos FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_id));
--> statement-breakpoint
CREATE POLICY aircraft_photos_insert ON public.aircraft_photos FOR INSERT TO app_user
  WITH CHECK (EXISTS (SELECT 1 FROM public.aircraft a
                      WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id())
    AND storage_key LIKE 'aircraft/' || aircraft_id::text || '/%');
--> statement-breakpoint
CREATE POLICY aircraft_photos_update ON public.aircraft_photos FOR UPDATE TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY aircraft_photos_delete ON public.aircraft_photos FOR DELETE TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint

-- aircraft_documents: the owner and admins only -------------------------------------
GRANT SELECT, INSERT, DELETE ON public.aircraft_documents TO app_user;
--> statement-breakpoint
GRANT UPDATE (title, document_id, expires_on) ON public.aircraft_documents TO app_user;
--> statement-breakpoint
CREATE POLICY aircraft_documents_select ON public.aircraft_documents FOR SELECT TO app_user
  USING (public.user_has_role('admin') OR EXISTS (
    SELECT 1 FROM public.aircraft a
    WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
-- New documents start unreviewed (pending, or no status for reference documents) and may only
-- use the owner's own uploads.
CREATE POLICY aircraft_documents_insert ON public.aircraft_documents FOR INSERT TO app_user
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.aircraft a
            WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id())
    AND EXISTS (SELECT 1 FROM public.documents d
                WHERE d.id = document_id AND d.owner_id = app.current_user_id())
    AND status IS NOT DISTINCT FROM
      (CASE WHEN kind IN ('cofa', 'arc', 'insurance') THEN 'pending' END)::public.verification_status
    AND rejection_reason IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND reminder_sent_at IS NULL);
--> statement-breakpoint
CREATE POLICY aircraft_documents_update ON public.aircraft_documents FOR UPDATE TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d
                      WHERE d.id = document_id AND d.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY aircraft_documents_delete ON public.aircraft_documents FOR DELETE TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint

-- rental_requirements: visible with the aircraft; the owner manages them -------------
GRANT SELECT, INSERT, DELETE ON public.rental_requirements TO app_user;
--> statement-breakpoint
GRANT UPDATE (min_pilot_rating, allow_unrated, unrated_needs_checkout, licence_types,
  required_ratings, min_total_hours, min_type_hours, min_90_days_hours, min_age)
  ON public.rental_requirements TO app_user;
--> statement-breakpoint
CREATE POLICY rental_requirements_select ON public.rental_requirements FOR SELECT TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_id));
--> statement-breakpoint
CREATE POLICY rental_requirements_insert ON public.rental_requirements FOR INSERT TO app_user
  WITH CHECK (EXISTS (SELECT 1 FROM public.aircraft a
                      WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY rental_requirements_update ON public.rental_requirements FOR UPDATE TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
--> statement-breakpoint
CREATE POLICY rental_requirements_delete ON public.rental_requirements FOR DELETE TO app_user
  USING (EXISTS (SELECT 1 FROM public.aircraft a
                 WHERE a.id = aircraft_id AND a.owner_id = app.current_user_id()));
