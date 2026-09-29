# Security review (KAN-69)

Reviewed on 28 September 2026 (all migrations up to `0046_moderation`). Repeat this review
before launch and whenever a new table, storage path or Server Action is added. The items marked
**(test)** are checked automatically by `npm test`.

## 1. Database access (RLS)

- [x] Row-level security is on for every table in `public` **(test: `tests/db/guards.test.ts`)**.
- [x] The app connects as `app_user` for everything users do (`asUser` / `asAnon`); only Better
      Auth, admin code after `requireAdmin()` and the daily job use the owner connection.
- [x] Login tables (`users`, `sessions`, `accounts`, `verifications`, `rate_limits`) have no
      grants for `app_user` **(test)**.
- [x] Users can only change the columns they own (column grants): profiles (name, bio, avatar,
      home airfield), settings (language, units, phone), flight log check-out readings,
      notification read markers. Ratings, suspension, statuses and review fields are changed only
      by functions or admin code.
- [x] Every `SECURITY DEFINER` function pins `search_path = ''` **(test)** and none can be run by
      `PUBLIC` **(test)**; each is granted to `app_user` on purpose or not at all (internal).
- [x] Every table has tests of what anonymous visitors, the owner and another user can do
      (`tests/db/*.test.ts`).

| Data | Who can read | Who can change |
|------|--------------|----------------|
| Profiles, airports, listed aircraft, photos, published reviews | everyone | the owner (limited columns) |
| Settings (language, units, phone) | the user | the user; phone shown to the other side of an accepted booking via `booking_contacts()` |
| Credentials, medicals, documents | the user, admins | the user (verified items go back to pending when edited) |
| Aircraft documents | the owner, admins | the owner |
| Bookings, events, flight logs, legs, uplifts, remarks | pilot and owner of the booking | through functions only |
| Calendar | the owner (full), others see busy periods / kinds only | the owner (blocks) |
| Defects | reporter, owner, admins | through functions |
| Reviews | author; everyone once published and not hidden; admins | through functions; admins hide |
| Conversations, messages | the two participants | through functions |
| Reports | the reporter, admins | reporter creates; admins close |
| Notifications | the user | the user (read marker only) |
| Admin audit log | admins | admin code only |

## 2. Files

- [x] Private documents (licences, medicals, aircraft documents, receipts, defect photos) are in
      private storage and served only by `app/api/documents/[id]`, which checks access through
      RLS and returns 404 otherwise; admin views are written to the audit log.
- [x] File types are checked by content (`lib/files/sniff.ts`), sizes are limited (4 MB), and
      uploads that are never attached are deleted by the daily job.
- [x] Public files (avatars, aircraft photos) live under the user's / aircraft's folder; the
      upload routes check the user and, for photos, aircraft ownership.
- [x] The local driver (development only) keeps private files outside the served folder and
      refuses paths outside its root.

## 3. Server Actions and routes

- [x] Every Server Action checks the caller with `requireUser` / `requireProfile` /
      `requireAdmin` (directly or via a helper), except log-in and sign-up **(test:
      `lib/server-actions.test.ts`)**. Input is validated with Zod before any database call.
- [x] Admin pages and actions use `requireAdmin()` (404 for everyone else), also in the admin
      layout.
- [x] Route handlers: account export, avatar, documents, photos, usage and pilot legs check the
      user; `/api/cron/daily` needs `CRON_SECRET` (constant-time comparison); `/api/airports` and
      `/api/health` are public on purpose (no personal data).
- [x] Suspended users: sessions deleted, new sessions refused (Better Auth hook), booking
      requests fail eligibility, messages and reviews refused by triggers.

## 4. Browser and transport

- [x] Security headers on every response: `X-Content-Type-Options`, `Referrer-Policy`,
      `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Permissions-Policy`, HSTS
      (`next.config.ts`).
- [x] Cookies: only the session (HttpOnly, Secure, SameSite=Lax, by Better Auth) and the
      language cookie.
- [x] No raw HTML from users is rendered (help articles use our own Markdown renderer, links are
      limited to safe schemes).

## 5. Found and fixed in this review

- Added the security headers (there were none), and later (29 Sep) a strict
  Content-Security-Policy with a fresh nonce per request (`proxy.ts`, `lib/csp.ts`):
  `'strict-dynamic'` scripts, own styles, images only from our storage hosts and the map,
  no framing, no plugins. `tests/e2e/csp.spec.ts` fails on any CSP violation.
- Added the automated guards above so the rules can't silently break.
- Added spam limits: 30 messages per sender in 10 minutes, 20 reports per reporter a day
  (`0047_content_limits`); log-in and sign-up are rate-limited by Better Auth.

## 6. Open items (before or soon after launch)

- [ ] Switch on email verification once real email (SMTP) is configured
      (`AUTH_REQUIRE_EMAIL_VERIFICATION=true`).
- [ ] Lawyer review of the terms and privacy policy (company details are placeholders).
- [ ] Enable point-in-time recovery / backups on the production database (see
      `docs/deployment.md`).
