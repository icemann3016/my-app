# my-app

[![CI](https://github.com/icemann3016/my-app/actions/workflows/ci.yml/badge.svg)](https://github.com/icemann3016/my-app/actions/workflows/ci.yml)

A European general aviation marketplace: rent aircraft from verified owners, with two-way ratings.

**Live (preview):** https://my-app-zeta-gold-25.vercel.app

## Getting started

Requirements: Node.js 22+ and Git.

```bash
git clone https://github.com/icemann3016/my-app.git
cd my-app
npm install
cp .env.example .env.local   # fill in DATABASE_URL and BETTER_AUTH_SECRET at least
npm run db:migrate
npm run dev
```

Open http://localhost:3000. No cloud account? Run a local Postgres with `docker compose up -d db`
and use `DATABASE_URL=postgres://postgres:postgres@localhost:5432/myapp`.

Deploying or moving to Google Cloud / Azure: see [docs/deployment.md](docs/deployment.md).

## Working together

See [CONTRIBUTING.md](CONTRIBUTING.md) for how we work, and [CLAUDE.md](CLAUDE.md) for the instructions Claude follows.
