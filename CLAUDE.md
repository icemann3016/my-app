# CLAUDE.md

@AGENTS.md

This file tells Claude how to work in this repo. Claude reads it at the start of every session.
**Keep it up to date.** When the two of us agree on a decision, write it down here.

## Project

- **Name:** my-app (placeholder, rename later)
- **What it is:** A European general aviation marketplace: pilots rent aircraft from owners (with verified licences and two-way ratings), owners hire maintenance technicians, and airports take PPR, parking, hangar and service requests online.
- **Requirements:** [`docs/business-requirements.md`](docs/business-requirements.md) is the source of truth for *what* to build. **Read it before starting any feature** and reference requirement IDs (e.g. `BKG-3`) in branches, commits and PRs.
- **Plan:** [`docs/implementation-plan.md`](docs/implementation-plan.md) has the architecture, data model and milestones M0–M10. Tasks are GitHub issues. **Work on the current milestone's issues in order** and follow the plan's key technical decisions (§4).
- **Current phase:** Phase 1 (MVP) — accounts, pilot verification, aircraft listings, search, booking requests, ratings. Don't build Phase 2–4 features unless asked.
- **Team:** Zlati + friend, each working with our own Claude.
- **Status:** M0 done. Live on Vercel: https://my-app-zeta-gold-25.vercel.app (every push to main deploys). **M1 in progress:** sign-up/login, password reset, profiles, roles, dashboard, public profile done and verified on the portable stack (#10, #12–#14 closed). Next: Google sign-in (#11), data export/deletion (#15), i18n (#16).
- **Portability:** the app must stay movable to Google Cloud or Azure: no provider-specific SDKs outside `lib/storage` and `lib/email` drivers. See [`docs/deployment.md`](docs/deployment.md).

## Tech stack

- Next.js 16 (App Router, Server Components, Server Actions) + React 19 + TypeScript (strict), Node.js 22
- UI: Tailwind CSS v4 + shadcn/ui (`components/ui/`, add more with `npx shadcn@latest add <name>`). Forms: Zod + `useActionState`
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

docker build -t my-app .   # production container
docker compose up -d db    # local Postgres (no cloud account needed)
```

CI runs typecheck, lint, format:check, unit + database tests, build, the full e2e journey against a throwaway Postgres, and a Docker build.

## Project structure

```
app/
  (marketing)/        # public pages: home, terms, privacy
  (auth)/             # login, signup, forgot/reset password + actions.ts (auth Server Actions)
  (app)/              # logged-in pages: dashboard, account, u/[id] (public profile), search, owner/…
  api/auth/           # Better Auth endpoints (email links, OAuth callbacks)
  api/account/avatar/ # photo upload
  api/health/         # health check for load balancers
  files/              # serves uploads when STORAGE_DRIVER=local
components/
  ui/                 # shadcn/ui primitives (Button, Card, Dialog, Sheet, DropdownMenu…)
  forms/              # TextField, TextAreaField, SubmitButton, FormMessage
  layout/             # SiteHeader, UserMenu, MobileNav, SiteFooter, Logo
lib/
  auth/               # auth.ts (Better Auth config), session.ts (getUser, requireUser…), redirect.ts
  db/                 # index.ts (connection), rls.ts (asUser/asAnon), schema/ (Drizzle tables)
  storage/            # file storage drivers
  email/              # email drivers + templates
  validation/         # Zod schemas shared by forms and Server Actions
  forms.ts            # FormState type + helpers for useActionState forms
  site.ts             # app name + navigation (rename the app here)
db/migrations/        # SQL migrations (generated + custom), applied with npm run db:migrate
tests/                # e2e/ (Playwright), db/ (database security tests)
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
- Airports are identified by **ICAO code** (e.g. `LBSF`).
- Medical certificate data is GDPR special-category data: never expose the document, only "valid until".
- The app never replaces official records (CRS, logbooks), ATC clearance or customs procedures. Say so in the UI where relevant.

## Conventions

- **Auth:** protect pages, Server Actions and route handlers with `requireUser()` / `requireProfile()` (or `getUser()`) from `lib/auth/session.ts`. They redirect to `/login?next=…`. Call Better Auth on the server via `getAuth().api.*`.
- **Forms:** a Server Action `(prev: FormState, formData) => Promise<FormState>` validates with a Zod schema from `lib/validation/`, and a client form uses `useActionState` + `TextField` + `SubmitButton` + `FormMessage`. Return `values` (never passwords) so fields refill after errors.
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

- 2026-09-26: **Portable stack.** Replaced Supabase Auth/SDK with Better Auth + Drizzle on plain Postgres, file storage and email behind drivers, Docker image + deployment guide, so the app can move to Google Cloud or Azure. Supabase is now only the Postgres + file host. RLS kept via the `app_user` role and `app.user_id` setting.
- 2026-09-26: M1: forms use React 19 `useActionState` + Zod in Server Actions (no react-hook-form for now). Profiles are public; private settings live in `user_settings`. Column-level grants stop users changing ratings/suspension. Avatars upload from the browser to the `avatars` bucket (folder = user id).
- 2026-09-26: M0: shadcn/ui components copied into components/ui (new-york style, radix-ui). Dark mode follows the OS setting. Supabase CLI installed as a dev dependency (use `npx supabase …`). Vercel region fra1 via vercel.json.
- 2026-09-26: Stack = Supabase (EU) + Tailwind/shadcn + Vercel. Plan in docs/implementation-plan.md, tasks as GitHub issues (M0–M10). Solo mode: commit to main until the friend joins.
- 2026-09-26: Region = Europe/EASA. MVP = aircraft rental + ratings. Payments off-platform in MVP (no money through the app); in-app payments planned for Phase 4.
- 2026-09-25: Started with Next.js + TypeScript. Workflow is GitHub PRs, one branch per task.
