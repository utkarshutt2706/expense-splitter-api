# expense-splitter-api

NestJS REST API for the Expense Splitter application.

## Features

- Users and friends CRUD with unique contact validation
- Groups CRUD, with a single partial-update endpoint for rename and membership
  changes (membership replacement is a full `memberIds` array, not a delta)
- Expenses CRUD, with server-side recomputation and validation of submitted splits
  against `amount` + `splitType` before persisting
- Payments: create and list-by-group only (immutable once recorded, no
  get-by-id/update/delete)
- Group balances: net balance per member and a Simplify Debt–minimized settlement
  list, computed from expenses and payments together
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
`prisma/migrations/`). Render's `preDeployCommand` isn't available on the free plan,
so `pnpm prisma:migrate:deploy` runs as part of the **start command** instead (see
`render.yaml`), ahead of every boot rather than only on deploy — safe since it's a
no-op when there's nothing pending, and this also covers the free tier's frequent
idle-then-wake cycles, not just fresh deploys. Don't run migrations from GitHub
Actions itself; Render is the right place since it runs against the same environment
the deploy is targeting.

The whole service is defined as code in `render.yaml` (a Render Blueprint) rather
than manual dashboard configuration — build/start commands, region, plan, and which
env vars are secrets vs. plain values all live there and are reviewable like any
other change.

## Required repository secrets

- `RENDER_DEPLOY_HOOK_URL` — from the Render service's Settings > Deploy Hook
- `SONAR_TOKEN` — from SonarCloud, for the `Sonar` workflow

## Branch protection

Same governance model as the frontend repo: a ruleset on `main` (PRs only, no direct
push, linear history) with `review-required` (from `review-gate.yml`), the `CI` jobs,
and the Sonar quality gate marked as required checks. This has to be configured by
hand in GitHub's settings — it isn't expressible in the workflow files themselves.
