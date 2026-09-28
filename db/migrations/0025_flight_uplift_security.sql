-- M6 fuel and oil uplifts (BKG-13, BKG-14). Same rules as legs: both parties of the booking see
-- them, the pilot adds, changes and removes them while the log is editable. Receipts must be the
-- pilot's own documents.

GRANT SELECT, INSERT, DELETE ON public.flight_uplifts TO app_user;
--> statement-breakpoint
GRANT UPDATE (kind, airport_ident, quantity_l, fuel_type, oil_grade, price, paid_by, receipt_id)
  ON public.flight_uplifts TO app_user;
--> statement-breakpoint
CREATE POLICY flight_uplifts_select ON public.flight_uplifts FOR SELECT TO app_user
  USING (public.flight_log_role(flight_log_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY flight_uplifts_insert ON public.flight_uplifts FOR INSERT TO app_user
  WITH CHECK (public.flight_log_editable(flight_log_id) AND (receipt_id IS NULL OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = receipt_id AND d.owner_id = app.current_user_id())));
--> statement-breakpoint
CREATE POLICY flight_uplifts_update ON public.flight_uplifts FOR UPDATE TO app_user
  USING (public.flight_log_editable(flight_log_id))
  WITH CHECK (public.flight_log_editable(flight_log_id) AND (receipt_id IS NULL OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = receipt_id AND d.owner_id = app.current_user_id())));
--> statement-breakpoint
CREATE POLICY flight_uplifts_delete ON public.flight_uplifts FOR DELETE TO app_user
  USING (public.flight_log_editable(flight_log_id));
--> statement-breakpoint

-- The owner of the aircraft may open the pilot's check-out photo and receipts of their booking
-- (and the pilot those of the log). Nothing else of the pilot's documents.
CREATE OR REPLACE FUNCTION public.flight_log_document_visible(doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flight_logs l
    WHERE l.checkout_photo_id = doc_id AND public.flight_log_role(l.id) IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.flight_uplifts u
    WHERE u.receipt_id = doc_id AND public.flight_log_role(u.flight_log_id) IS NOT NULL
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.flight_log_document_visible(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.flight_log_document_visible(uuid) TO app_user;
--> statement-breakpoint
CREATE POLICY documents_select_flight_log ON public.documents FOR SELECT TO app_user
  USING (public.flight_log_document_visible(id));
