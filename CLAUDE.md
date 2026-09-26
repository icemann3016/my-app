# CLAUDE.md

This file tells Claude how to work in this repo. Claude reads it at the start of every session.
**Keep it up to date.** When the two of us agree on a decision, write it down here.

## Project

- **Name:** my-app (placeholder, rename later)
- **What it is:** A European general aviation marketplace: pilots rent aircraft from owners (with verified licences and two-way ratings), owners hire maintenance technicians, and airports take PPR, parking, hangar and service requests online.
- **Requirements:** [`docs/business-requirements.md`](docs/business-requirements.md) is the source of truth for *what* to build. **Read it before starting any feature** and reference requirement IDs (e.g. `BKG-3`) in branches, commits and PRs.
- **Current phase:** Phase 1 (MVP) — accounts, pilot verification, aircraft listings, search, booking requests, ratings. Don't build Phase 2–4 features unless asked.
- **Team:** Zlati + friend, each working with our own Claude.
- **Status:** Skeleton + requirements draft. No features built yet.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Plain CSS in `app/globals.css` for now (no UI library chosen yet)
- Node.js 22 (see `.nvmrc`)
- Hosting, database, auth: **not decided yet**. Ask before adding any of these.

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
docs/           # business requirements and other project docs
```

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

1. **Start from an up-to-date `main`.** Run `git pull` before starting.
2. **One branch per task:** `<name>/<short-description>`, e.g. `zlati/login-page`.
3. **Keep changes small and focused.** One feature or fix per PR.
4. **Before finishing:** run `npm run typecheck` and `npm run build`. Both must pass.
5. **Commit messages:** short and imperative, e.g. "Add login form".
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

- 2026-09-26: Region = Europe/EASA. MVP = aircraft rental + ratings. Payments off-platform in MVP (no money through the app); in-app payments planned for Phase 4.
- 2026-09-25: Started with Next.js + TypeScript. Workflow is GitHub PRs, one branch per task.
