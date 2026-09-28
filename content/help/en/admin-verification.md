# Verification (admins)

Admins are made with `npm run admin:grant -- email@example.com` (and removed with `--revoke`); the
person must have signed up first.

- **Admin → Verification queue** lists pilot credentials and aircraft documents waiting for review.
- Open an item, look at the document and **Verify** or **Reject** with a reason (sent to the
  person).
- Admins can't review their own credentials or aircraft.
- Every document an admin opens, and every decision, is written to the audit log.
