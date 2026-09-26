# ownAplane

[![CI](https://github.com/icemann3016/ownAplane/actions/workflows/ci.yml/badge.svg)](https://github.com/icemann3016/ownAplane/actions/workflows/ci.yml)

A European general aviation marketplace: rent aircraft from verified owners, with two-way ratings.

**Live (preview):** https://ownaplane.eu

## Getting started

Requirements: Node.js 22+ and Git.

```bash
git clone https://github.com/icemann3016/ownAplane.git
cd ownAplane
npm install
cp .env.example .env.local   # fill in DATABASE_URL and BETTER_AUTH_SECRET at least
npm run db:migrate
npm run airports:import     # loads ~7,400 European airfields (about a minute)
npm run dev
```

To verify pilot credentials, sign up in the app and make yourself an admin:
`npm run admin:grant -- you@example.com` (then Account menu → Admin).

Open http://localhost:3000. No cloud account? Run a local Postgres with `docker compose up -d db`
and use `DATABASE_URL=postgres://postgres:postgres@localhost:5432/ownaplane`.

Deploying or moving to Google Cloud / Azure: see [docs/deployment.md](docs/deployment.md).

## Working together

See [CONTRIBUTING.md](CONTRIBUTING.md) for how we work, and [CLAUDE.md](CLAUDE.md) for the instructions Claude follows.
