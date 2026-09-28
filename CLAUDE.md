# CLAUDE.md

@AGENTS.md

This file tells Claude how to work in this repo. Claude reads it at the start of every session.
**Keep it up to date.** When the two of us agree on a decision, write it down here.

## Project

- **Name:** ownAplane (code/technical name: `ownaplane`)
- **What it is:** A European general aviation marketplace: pilots rent aircraft from owners (with verified licences and two-way ratings), owners hire maintenance technicians, and airports take PPR, parking, hangar and service requests online.
- **Requirements:** [`docs/business-requirements.md`](docs/business-requirements.md) is the source of truth for *what* to build. **Read it before starting any feature** and reference requirement IDs (e.g. `BKG-3`) in branches, commits and PRs.
- **Plan:** [`docs/implementation-plan.md`](docs/implementation-plan.md) has the architecture, data model and milestones M0–M10. Tasks are GitHub issues. **Work on the current milestone's issues in order** and follow the plan's key technical decisions (§4).
- **Current phase:** Phase 1 (MVP) — accounts, pilot verification, aircraft listings, search, booking requests, ratings. Don't build Phase 2–4 features unless asked.
- **Team:** Zlati + friend, each working with our own Claude.
- **Status:** M0 done. Live at https://ownaplane.eu (every push to main deploys). **M1 done:** accounts, profiles, roles, public profiles, Google sign-in (needs Google keys), data export + account deletion, English/Bulgarian + units preference. **M2 done:** 7,392 European airfields (OurAirports) with time zones, airport search box, home airfield linked to airports. **M3 done:** pilot credentials (licences, ratings, medical, experience) with private document upload, admin verification queue with audit log, verified badges on public profiles, daily expiry reminders. **M4 done:** aircraft listings (step-by-step form saved as a draft, photos, CofA/ARC/insurance verified by admins, reference documents, rental requirements), My aircraft dashboard, public aircraft page, auto-unlist when the ARC or insurance expires. **M5 done:** aircraft calendar with a no-overlap constraint and owner calendar page, eligibility check (`my_eligibility()`, incl. the night rule), search by airfield/radius/dates/filters with list and map (MapLibre + OpenFreeMap), aircraft page with availability and "can I rent this". Open: IFR/weather check (METAR/TAF), see decisions. Next: **M6 Booking**.
- **Domain:** https://ownaplane.eu (Vercel; `BETTER_AUTH_URL=https://ownaplane.eu`). The *.vercel.app addresses keep working (trusted automatically). Next infra step: real email via SMTP (Resend) on ownaplane.eu, then switch on email verification.
- **Portability:** the app must stay movable to Google Cloud or Azure: no provider-specific SDKs outside `lib/storage` and `lib/email` drivers. See [`docs/deployment.md`](docs/deployment.md).

## Tech stack

- Next.js 16 (App Router, Server Components, Server Actions) + React 19 + TypeScript (strict), Node.js 22
- UI: Tailwind CSS v4 + shadcn/ui (`components/ui/`, add more with `npx shadcn@latest add <name>`). Forms: Zod + `useActionState`
- **Languages:** next-intl, English + Bulgarian (`messages/en.json`, `messages/bg.json`); language from a cookie/user setting, else the browser. No locale in URLs.
- **Database:** PostgreSQL 14+ through **Drizzle ORM** (`postgres` driver). Hosted on Supabase today, but we use it as *plain Postgres* only. **RLS on every table.**
- **Login:** **Better Auth** (`lib/auth/auth.ts`), users/sessions in our own tables
- **Files:** `lib/storage` (drivers: `s3` = Supabase Storage / Google Cloud Storage / AWS / R2, `azure`, `local`)
- **Email:** `lib/email` (drivers: `smtp`, `console`)
- Tests: Vitest (unit + database) + Playwright · Hosting: Vercel (`fra1`) today, `Dockerfile` for Cloud Run / Azure Container Apps · CI: GitHub Actions
- Never import `@supabase/*`, Google or Azure SDKs outside the storage/email drivers. Ask before adding any other significant dependency.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:3000 (emails are printed in this terminal)
npm run typecheck    # TypeScript check (generates route types first)
npm run lint         # ESLint
npm run format       # Prettier: format all files (format:check in CI)
npm test             # unit tests + database tests (database tests need TEST_DATABASE_URL, else skipped)
npm run test:e2e     # browser tests (Playwright), desktop + mobile. E2E_FULL=1 adds the sign-up journey
npm run build        # production build

npm run db:generate        # create a migration from changes in lib/db/schema
npm run db:custom -- name  # create an empty SQL migration (RLS policies, grants, functions, triggers)
npm run db:migrate         # apply migrations to DATABASE_URL
npm run db:studio          # browse the database in the browser
npm run airports:import    # (re)load European airfields from OurAirports; -- --file x.csv for a local file
npm run admin:grant -- me@example.com   # make a user an admin (add --revoke to remove)

docker build -t ownaplane .   # production container
docker compose up -d db    # local Postgres (no cloud account needed)
```

CI runs typecheck, lint, format:check, unit + database tests, build, the full e2e journey against a throwaway Postgres, and a Docker build.

## Project structure

```
app/
  (marketing)/        # public pages: home, terms, privacy
  (auth)/             # login, signup, forgot/reset password + actions.ts (auth Server Actions)
  (app)/              # logged-in pages: dashboard, account (+ credentials tab), admin/verifications,
                      #   u/[id] (public profile), aircraft/[id] (public listing + availability),
                      #   search, owner/aircraft (my aircraft, new, [id]/calendar, details…requirements)
  api/auth/           # Better Auth endpoints (email links, OAuth callbacks)
  api/account/avatar/ # photo upload
  api/documents/      # private document upload (POST) and viewing ([id], owner/admin only)
  api/aircraft/[id]/photos/ # aircraft photo upload (owner only)
  api/cron/daily/     # daily job (expiry reminders, clean-up), needs CRON_SECRET
  api/health/         # health check for load balancers
  files/              # serves uploads when STORAGE_DRIVER=local
components/
  ui/                 # shadcn/ui primitives (Button, Card, Dialog, Sheet, DropdownMenu…)
  forms/              # TextField, TextAreaField, SelectField, SubmitButton, FormMessage
  pilot/              # StatusBadge, ExpiryText
  aircraft/           # AircraftStatusBadge, MonthCalendar, RequirementsList, SectionHeading…
  document-field.tsx  # upload a private document in a form (submits its id)
  layout/             # SiteHeader, UserMenu, MobileNav, SiteFooter, LanguageSwitcher, Logo
  auth/               # GoogleSignIn
  airport-picker.tsx  # airport search box (combobox), submits the airport ident
lib/
  auth/               # auth.ts (Better Auth config), session.ts (getUser, requireUser, requireAdmin…), errors.ts
  admin/              # verification queues + reviewCredential(), reviewAircraftDocument() (trusted admin code)
  pilot/              # catalog (licence types, ratings), labels, validity/summary, credentials, reminders
  aircraft/           # catalog, queries, photos, documents, requirements, expiry (daily job), public page data,
                      #   calendar, eligibility (+ eligibility-text), search
  domain/             # pure logic: units (L/US gal, kg/lb), time (airport-local ↔ UTC, calendar days)
  documents.ts        # save/read/delete private documents (checks file content, logs admin views)
  files/sniff.ts      # detect file type from content
  db/                 # index.ts (connection), rls.ts (asUser/asAnon), schema/ (Drizzle tables)
  airports.ts         # searchAirports(), getAirport(), airportPlace()
  storage/            # file storage drivers
  email/              # email drivers + templates
  validation/         # Zod schemas shared by forms and Server Actions
  forms.ts            # FormState type + helpers for useActionState forms
  i18n/               # config.ts (locales, resolveLocale), server.ts (localizedFieldErrors, setLocaleCookie)
  site.ts             # app name + navigation (rename the app here)
db/migrations/        # SQL migrations (generated + custom), applied with npm run db:migrate
messages/             # translations: en.json (source) and bg.json (same keys)
i18n/request.ts       # picks the language for each request
scripts/              # import-airports.mjs (+ airports/transform.mjs), grant-admin.mjs, create-github-issues.mjs
tests/                # e2e/ (Playwright), db/ (database security tests), fixtures/ (test airports)
docs/                 # requirements, implementation plan, deployment guide
Dockerfile, docker-compose.yml
```

Target structure for the rest of the app is in the plan, §6. When new top-level folders are added, list them here.

## Database workflow

- The schema changes **only** through migrations in `db/migrations/`. Tables: edit `lib/db/schema/*.ts`, then `npm run db:generate`. RLS policies, grants, functions, triggers: `npm run db:custom -- <name>` and write SQL (separate statements with `--> statement-breakpoint`). Apply with `npm run db:migrate`. Never change tables by hand in a dashboard.
- **Every table** has RLS enabled (`.enableRLS()` in the schema) and explicit policies `TO app_user` in a custom migration. Policies use `app.current_user_id()`. Grant `app_user` only the columns users may change.
- **User-facing queries** go through `asUser(userId, tx => …)` or `asAnon(tx => …)` from `lib/db/rls.ts`, so RLS applies. `getDb()` (owner, bypasses RLS) only for Better Auth and trusted admin/cron code, after checking permissions.
- Every migration with tables/policies gets tests in `tests/db/` (like `security.test.ts`): check what anonymous visitors, the owner and another user can and cannot do.
- Use only plain PostgreSQL features available on Supabase, Cloud SQL and Azure. New extensions: note them in `docs/deployment.md`.
- Don't name SQL functions like common helpers (`has_role`, `is`, `ok`…); we use `user_has_role()`.
- Keys live in `.env.local` (see `.env.example`). Share them with teammates through a password manager, never in git or chat.

## Domain rules (aviation)

- Region: **Europe / EASA** rules and terms (PPL/LAPL, Part-66, Part-ML, ARC). Not FAA.
- Store all times in **UTC**; display airport-local time with UTC alongside on booking and PPR screens.
- Airports come from the `airports` table and are identified by their OurAirports **ident**: the ICAO code when there is one (`LBSF`), otherwise a local id (`BG-0004`, many small airfields). Show `code` (ICAO or ident) to users. Pick airports with `AirportPicker`, never free text. Each airport has an IANA `timezone` for local times.
- Medical certificate data is GDPR special-category data: only the pilot and admins see it. Public profiles show only verified licence types and ratings (`public.pilot_badges`), never numbers, documents or medical data. For bookings, owners will only get a yes/no "meets requirements".
- Private documents live in private storage and are only served by `app/api/documents/[id]` (owner or admin, else 404). Admin views and decisions are written to `admin_actions`.
- Credentials count only when **verified and not expired** (`isUsable()` in `lib/pilot/validity.ts`). Editing a verified item sends it back to "pending" (database trigger).
- The app never replaces official records (CRS, logbooks), ATC clearance or customs procedures. Say so in the UI where relevant.

## Conventions

- **Auth:** protect pages, Server Actions and route handlers with `requireUser()` / `requireProfile()` (or `getUser()`) from `lib/auth/session.ts`. They redirect to `/login?next=…`. Admin pages and actions use `requireAdmin()` (404 for everyone else). Call Better Auth on the server via `getAuth().api.*`; read its error codes with `authErrorCode()`.
- **Forms:** a Server Action `(prev: FormState, formData) => Promise<FormState>` validates with a Zod schema from `lib/validation/`, and a client form uses `useActionState` + `TextField` + `SubmitButton` + `FormMessage`. Return `values` (never passwords) so fields refill after errors.
- **Text & translations:** never hard-code user-facing text. Add keys to **both** `messages/en.json` and `messages/bg.json` (a unit test checks they match). Server Components: `await getTranslations("ns")`; Client Components: `useTranslations("ns")`; page titles via `generateMetadata`. Zod messages are keys from the `validation` namespace, translated with `localizedFieldErrors()`. Format dates/numbers with the user's locale (`intlLocale()`).
- **Headings:** every page has one `h1`. `CardTitle` takes `as="h1" | "h2" | "h3"` when it's a page or section title.

- TypeScript everywhere. No `any` unless there's a comment explaining why.
- Server Components by default. Add `"use client"` only when a component needs state, effects or browser APIs.
- Component files: `PascalCase.tsx`. Other files: `kebab-case.ts`.
- Import from the project root with `@/` (e.g. `import { x } from "@/lib/x"`).
- Keep components small. If a file passes about 200 lines, split it.
- Secrets go in `.env.local` (git-ignored). Add new variable names to `.env.example`.

## How Claude should work here

> **Solo mode (current):** While Zlati works alone, commit directly to `main` in small commits (steps 2 and 6 about branches don't apply yet). **When the friend joins, delete this note** and switch to branches + PRs.

1. **Start from an up-to-date `main`.** Run `git pull` before starting.
2. **One branch per task:** `<name>/<issue-number>-<short-description>`, e.g. `zlati/9-signup`.
3. **Keep changes small and focused.** One issue per branch/PR. For anything non-trivial, propose the approach before coding.
4. **Before finishing:** meet the definition of done in the plan (§9): acceptance criteria, RLS + tests for new tables, and typecheck/lint/test/build passing.
5. **Commit messages:** short and imperative, with the issue number, e.g. "Add sign-up form (#9)".
6. **Never** commit secrets, push directly to `main`, or add a big dependency without asking.
7. **Ask before** changing the tech stack, the folder structure, or anything in this file.
8. If a task touches an area the other person owns (see below), say so in the PR.

## Who owns what

_TODO: split areas so we don't edit the same files at the same time._

| Area | Owner |
|------|-------|
| _e.g. UI / pages_ | _Zlati_ |
| _e.g. data / API_ | _friend_ |

## Decisions log

Add one line per decision, newest first.

- 2026-09-28: Remarks and known items (BKG-15): the pilot adds remarks (aircraft / weather / airfield) to the flight log while it's editable; the aircraft's owner sees them per booking and in the aircraft's Remarks tab, and marks aircraft remarks as **known items** (and later as fixed) with `set_known_item()`. Open known items are shown to pilots with a requested, accepted or in-progress booking of that aircraft via `known_items_for_aircraft()` (text and date only, never who wrote them). Defects that affect airworthiness stay separate (BKG-8, KAN-56).
- 2026-09-28: Fuel and oil in the amount due (BKG-13/14): fuel/oil uplifts store quantity (L), price in the booking's currency and who paid (pilot / owner's account). Wet rate: fuel the pilot paid for is taken off; dry rate: fuel from the owner's account is added; **oil is part of both rates**, so oil the pilot paid for is always taken off (`fuelSettlement()`). Entries without a price don't count and are flagged. The other party of a booking can open the flight log's check-out photo and receipts (`flight_log_document_visible()`); only admin views go to the audit log.
- 2026-09-27: Night and weather in bookings (M6). Legally what counts is the **booked flight's departure and arrival airfields** (and any stops), never the aircraft's or the pilot's base: the rental is night if it is night at any of them (30 min after sunset to 30 min before sunrise) → night-VFR aircraft + Night rating. Before a booking exists (search, aircraft page) the aircraft's base is used as a preview only, and the UI says so. Weather (IFR) is a **warning, never a block** (PIC decides), shown to pilot and owner: TAF once departure is within its range (~24–30 h), METAR as the flight approaches and at check-out, for every airfield of the flight. Airfields without a METAR use the nearest reporting station within 50 km (Lesnovo LBLS → LBSF), else "no weather report nearby". Below VFR = EASA minima (visibility < 5 km or ceiling BKN/OVC/VV < 1,500 ft); warn when the pilot has no valid IR or the aircraft isn't IFR. Source: aviationweather.gov (NOAA, free, no key).
- 2026-09-27: Night rule: any part of a rental from 30 min after sunset to 30 min before sunrise at the home base is **night**: the aircraft must be approved for night VFR and the pilot needs a verified, valid Night rating (`period_needs_night()`, sunrise/sunset in plain SQL, polar night/midnight sun handled). Night-period searches hide aircraft without night VFR. Map: MapLibre GL + OpenFreeMap tiles (no key; `NEXT_PUBLIC_MAP_STYLE_URL` to change).
- 2026-09-27: M5. Radius search uses plain SQL great-circle distance on airport lat/lon (no PostGIS; fine at our scale, stays portable); distances in km. Only extension: `btree_gist` for the calendar's exclusion constraint. Search times are local to the chosen airfield (UTC without one); filters live in the URL. Pilots see only busy periods of other people's aircraft (`aircraft_busy_periods()`), never notes or kinds. Eligibility is one SQL function (`eligibility_failures()`, not callable by users): pilots get their own reasons via `my_eligibility()`, owners only a yes/no via `pilot_meets_requirements()`. Credentials must be valid on the last day of the rental. Aeroplanes need a SEP/MEP (land) class rating and TMGs a TMG or SEP (land) rating automatically; ultralights and helicopters rely on the owner's required ratings. A checkout-flight requirement is a condition, not a refusal. Date of birth is optional in the pilot's experience, used only for minimum age.
- 2026-09-27: M4 aircraft listings. An aircraft can only be **listed** with a home base, price, ≥ 1 photo and a verified, unexpired ARC and insurance (`aircraft_listing_gaps()` + trigger); drafts never come back. Renewed ARC/insurance are added as new documents (the old one counts until the new one is verified); edits or deletions that would leave a listed aircraft without them are refused. The daily job unlists aircraft whose ARC/insurance expired and reminds owners 30 days before. Photos are public files (`aircraft/<id>/…`, max 20, shrunk in the browser); documents reuse the private `documents` storage. Quantities stored in SI (L/h, kg) and shown in the user's units. Registrations are unique among non-draft aircraft. Reference documents (POH, checklists, W&B) will be shared with renters once bookings exist (M6).
- 2026-09-26: Flight log added to M6 (BKG-7, BKG-12…16): per booking, legs with block and engine times, meters, fuel and oil before/after, refuelling and oil uplifts with receipts, remarks/PIREPs with "known items", usage history for owners. Stored in SI units and UTC; the amount due follows the aircraft's time basis (plan §4.8). Not an official journey/tech log.
- 2026-09-26: M3: private documents are served through the app (not presigned URLs) so access checks and audit logging work the same on every provider. Uploads ≤ 4 MB (Vercel limit); big photos are shrunk in the browser; file type checked by content. Admins verify with the owner connection after `requireAdmin()`, with an optimistic check (`updated_at`) and no self-review. Scheduled work runs through `/api/cron/daily` with `CRON_SECRET` (Vercel Cron today; Cloud Scheduler / Azure later). Email for real still pending (console driver).
- 2026-09-26: Custom domain ownaplane.eu. Google is only linked to an existing email/password account from Account → Security while logged in (Better Auth refuses implicit linking to unverified emails, which protects against account pre-hijacking).
- 2026-09-26: M2: airports keyed by OurAirports ident; only EU large/medium/small airports (no heliports/closed). Coordinates stored as plain lat/lon (no PostGIS yet; decide in M5 for radius search). Airport data is refreshed with `npm run airports:import`; stale rows are kept, not deleted.
- 2026-09-26: M1 finished. i18n with next-intl without locale routing (cookie + user_settings + Accept-Language). Google sign-in via Better Auth (button hidden until GOOGLE_* keys exist). Account deletion with password + typed confirmation; data export as JSON without secrets.
- 2026-09-26: App name is **ownAplane** (technical name `ownaplane`). Change the display name only in `lib/site.ts`.
- 2026-09-26: **Portable stack.** Replaced Supabase Auth/SDK with Better Auth + Drizzle on plain Postgres, file storage and email behind drivers, Docker image + deployment guide, so the app can move to Google Cloud or Azure. Supabase is now only the Postgres + file host. RLS kept via the `app_user` role and `app.user_id` setting.
- 2026-09-26: M1: forms use React 19 `useActionState` + Zod in Server Actions (no react-hook-form for now). Profiles are public; private settings live in `user_settings`. Column-level grants stop users changing ratings/suspension. Avatars upload from the browser to the `avatars` bucket (folder = user id).
- 2026-09-26: M0: shadcn/ui components copied into components/ui (new-york style, radix-ui). Dark mode follows the OS setting. Supabase CLI installed as a dev dependency (use `npx supabase …`). Vercel region fra1 via vercel.json.
- 2026-09-26: Stack = Supabase (EU) + Tailwind/shadcn + Vercel. Plan in docs/implementation-plan.md, tasks as GitHub issues (M0–M10). Solo mode: commit to main until the friend joins.
- 2026-09-26: Region = Europe/EASA. MVP = aircraft rental + ratings. Payments off-platform in MVP (no money through the app); in-app payments planned for Phase 4.
- 2026-09-25: Started with Next.js + TypeScript. Workflow is GitHub PRs, one branch per task.
