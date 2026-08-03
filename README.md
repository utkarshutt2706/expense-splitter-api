# expense-splitter-api

A free, open-source REST API for splitting shared expenses with friends — track who
paid for what, split it evenly or by exact amounts/percentages/shares, record
payments as debts get settled, and see the minimum set of transactions needed to
square everyone up. This repo is the backend; the frontend lives at
[expense-splitter](https://github.com/utkarshutt2706/expense-splitter).

## Live demo

A live instance is running at
**[utkarshutt2706.github.io/expense-splitter](https://utkarshutt2706.github.io/expense-splitter)**,
backed by this API on Render's free tier and a free-tier Neon Postgres database. It's
there to try the app out, not for real ongoing use — please don't hammer it with
heavy or automated traffic. Free-tier Postgres comes with real limits on storage and
compute, and there's only one instance serving everyone looking at the demo.

If you want to actually use this for your own group, **deploy your own instance** —
it's free and takes about ten minutes. See below.

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

## Deploy your own instance

Everything here runs on free tiers — no cost to run your own copy for a friend group.

1. **Fork this repo.**
2. **Create a database.** Sign up at [neon.tech](https://neon.tech) (free tier),
   create a project, and copy the connection string it gives you.
3. **Generate a shared secret.** This API has no per-user login — the frontend
   handles "who is this person" client-side, and the backend just needs one shared
   secret so it isn't sitting open on the public internet. Anything long and random
   works, e.g. `openssl rand -hex 32`.
4. **Deploy to Render.** Sign up at [render.com](https://render.com) (free tier),
   click **New +** → **Blueprint**, and connect your fork. Render reads
   [`render.yaml`](render.yaml) automatically and provisions the service — build
   command, start command, region, and plan are all already defined there. You'll be
   prompted for the two secrets it doesn't store in the file: `DATABASE_URL` (from
   step 2) and `API_KEY` (from step 3).
5. **Note your service URL** once it's live (something like
   `https://your-app.onrender.com`) — the frontend needs it.
6. **Deploy the frontend.** Fork
   [expense-splitter](https://github.com/utkarshutt2706/expense-splitter) and follow
   its own README, pointing it at your backend's URL and the same `API_KEY` you
   generated in step 3.
7. If your frontend ends up on a different origin than the default
   `CORS_ALLOWED_ORIGINS` value in `render.yaml`, update it (in the file or directly
   in Render's dashboard under Environment) to match — otherwise the browser will
   block requests to your API.

Database schema migrations run automatically as part of the app's start command
(`pnpm prisma:migrate:deploy`, ahead of every boot) — nothing extra to configure.
Render's free tier spins the service down after inactivity, so the first request
after a quiet period can take 30–50 seconds to wake it back up; the `/health`
endpoint is there for uptime pingers if you want to keep it warm.

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

## Optional: code quality gate (SonarCloud)

The canonical repo runs a [SonarCloud](https://sonarcloud.io) quality gate as a
required CI check, on top of the format/lint/build/test jobs. On your own fork,
whether to keep it is genuinely optional and depends on your plans:

- **Keep it on** if you intend to make ongoing changes — it catches maintainability
  issues (duplication, complexity, code smells) that tests alone don't, and it's
  already wired up in `sonar-project.properties` and `.github/workflows/sonar.yml`.
  You'll need your own SonarCloud organization/project (free for public repos) and a
  `SONAR_TOKEN` repository secret pointing at it — update `sonar.projectKey` and
  `sonar.organization` in `sonar-project.properties` to match.
- **Turn it off** if you're forking as-is with no changes planned — setting up a
  SonarCloud project for a fork you're not actively modifying is overhead with no
  payoff. Simplest option: delete `.github/workflows/sonar.yml` and
  `sonar-project.properties`, or just don't add `SONAR_TOKEN` and let that one
  workflow fail without marking it as a required check in your fork's branch
  protection settings.

## Contributing

Ideas, feature suggestions, and pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for how to get started, the branch/commit
conventions this repo follows, and what CI expects before a PR can merge.

## Required repository secrets

Only relevant if you want the same CI-gated auto-deploy flow as the canonical repo
(push to `main` → CI passes → Render deploy hook fires automatically). Optional on a
fork if you'd rather deploy manually from the Render dashboard.

- `RENDER_DEPLOY_HOOK_URL` — from the Render service's Settings > Deploy Hook
- `SONAR_TOKEN` — from SonarCloud, for the `Sonar` workflow (see above)

## Branch protection

The canonical repo uses a ruleset on `main` (PRs only, no direct push, linear
history) with `review-required` (from `review-gate.yml`), the `CI` jobs, and the
Sonar quality gate marked as required checks — same governance model as the frontend
repo. This has to be configured by hand in GitHub's settings; it isn't expressible in
the workflow files themselves. Entirely optional on a personal fork — adopt as much
or as little of it as fits how you're using your copy.
