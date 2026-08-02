# expense-splitter-api

NestJS REST API for the Expense Splitter application.

## Features

- Users and friends CRUD with unique contact validation
- Groups with atomic membership mutations
- Expenses with split calculation and persistence
- Group balances and simplified settlement transactions
- Health check endpoint for uptime monitoring

## Local development

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env` and fill in the values
3. Apply database migrations: `pnpm prisma:migrate:dev`
4. Start the app: `pnpm start:dev`

## Authentication

There's no per-user auth — the frontend already handles "who is this person" entirely
client-side. Every request (except `/health`) must include the shared secret as an
`x-api-key` header, matching the `API_KEY` environment variable. This exists only to
keep the API from sitting fully open on the public internet; it does not distinguish
between callers.

## API documentation

Interactive Swagger docs are served at `/docs` (and the raw spec at `/docs-json`).
Since Swagger's routes are mounted outside Nest's normal request pipeline, they aren't
covered by the `x-api-key` guard — instead `/docs` is gated by HTTP Basic Auth, using
the `API_KEY` value as the password (username is ignored). Browsers will prompt for
credentials automatically on first visit.

## Environment variables

- `PORT`
- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `NODE_ENV`
- `API_KEY` — shared secret the frontend must send on every request

## Deployment

This repository is intended for deployment on Render using a Node web service (no
Docker), connected to a PostgreSQL database on Neon. `render-deploy.yml` triggers a
Render deploy hook only after `CI` finishes successfully on `main` — Render's own
"Auto-Deploy" setting for this service should stay **off**, otherwise every push
triggers two independent deploys instead of one.

Schema migrations are managed with Prisma (`prisma/schema.prisma`,
`prisma/migrations/`). Configure `pnpm prisma:migrate:deploy` as Render's **Pre-Deploy
Command** for this service, so it runs against Neon before each deploy goes live.
Don't run migrations from GitHub Actions itself; Render's pre-deploy hook is the right
place since it runs against the same environment the deploy is targeting.

## Required repository secrets

- `RENDER_DEPLOY_HOOK_URL` — from the Render service's Settings > Deploy Hook
- `SONAR_TOKEN` — from SonarCloud, for the `Sonar` workflow

## Branch protection

Same governance model as the frontend repo: a ruleset on `main` (PRs only, no direct
push, linear history) with `review-required` (from `review-gate.yml`), the `CI` jobs,
and the Sonar quality gate marked as required checks. This has to be configured by
hand in GitHub's settings — it isn't expressible in the workflow files themselves.
