# CLAUDE.md

This file tells Claude how to work in this repo. Claude reads it at the start of every session.
**Keep it up to date.** When the two of us agree on a decision, write it down here.

## Project

- **Name:** my-app (placeholder, rename later)
- **What it is:** A European general aviation marketplace: pilots rent aircraft from owners (with verified licences and two-way ratings), owners hire maintenance technicians, and airports take PPR, parking, hangar and service requests online.
- **Requirements:** [`docs/business-requirements.md`](docs/business-requirements.md) is the source of truth for *what* to build. **Read it before starting any feature** and reference requirement IDs (e.g. `BKG-3`) in branches, commits and PRs.
- **Plan:** [`docs/implementation-plan.md`](docs/implementation-plan.md) has the architecture, data model and milestones M0–M10. Tasks are GitHub issues. **Work on the current milestone's issues in order** and follow the plan's key technical decisions (§4).
- **Current phase:** Phase 1 (MVP) — accounts, pilot verification, aircraft listings, search, booking requests, ratings. Don't build Phase 2–4 features unless asked.
- **Team:** Zlati + friend, each working with our own Claude.
- **Status:** Requirements + plan done. Next: **M0 Foundations**.

## Tech stack

- Next.js 16 (App Router, Server Components, Server Actions) + React 19 + TypeScript (strict)
- Node.js 22 (see `.nvmrc`)
- **Decided, being set up in M0:**
  - UI: Tailwind CSS v4 + shadcn/ui · Forms: Zod + react-hook-form
  - Backend: **Supabase** (Postgres, Auth, Storage), region Frankfurt, via `@supabase/ssr`. **RLS on every table.**
  - Schema changes only through SQL migrations in `supabase/migrations/`, then regenerate types
  - Email: Resend · Maps: MapLibre GL · Tests: Vitest + Playwright · Hosting: Vercel (`fra1`) · CI: GitHub Actions
- Ask before adding any other significant dependency.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:3000
npm run typecheck  # TypeScript check, must pass before opening a PR
npm run build      # production build, must pass before opening a PR
```

## Project structure

```
app/            # routes (App Router). page.tsx = page, layout.tsx = shared layout
  layout.tsx
  page.tsx
  globals.css
public/         # static files (images, icons)
docs/           # business requirements, implementation plan
scripts/        # one-off scripts (e.g. create-github-issues.mjs)
```

Target structure for the rest of the app is in the plan, §6.

When new top-level folders are added (e.g. `components/`, `lib/`), list them here.

## Domain rules (aviation)

- Region: **Europe / EASA** rules and terms (PPL/LAPL, Part-66, Part-ML, ARC). Not FAA.
- Store all times in **UTC**; display airport-local time with UTC alongside on booking and PPR screens.
- Airports are identified by **ICAO code** (e.g. `LBSF`).
- Medical certificate data is GDPR special-category data: never expose the document, only "valid until".
- The app never replaces official records (CRS, logbooks), ATC clearance or customs procedures. Say so in the UI where relevant.

## Conventions

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

- 2026-09-26: Stack = Supabase (EU) + Tailwind/shadcn + Vercel. Plan in docs/implementation-plan.md, tasks as GitHub issues (M0–M10). Solo mode: commit to main until the friend joins.
- 2026-09-26: Region = Europe/EASA. MVP = aircraft rental + ratings. Payments off-platform in MVP (no money through the app); in-app payments planned for Phase 4.
- 2026-09-25: Started with Next.js + TypeScript. Workflow is GitHub PRs, one branch per task.
