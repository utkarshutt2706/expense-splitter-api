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

- JWT-based registration and login, gating every endpoint except `/health`
- Users and friends CRUD with unique contact validation
- Groups CRUD, with a single partial-update endpoint for rename and membership
  changes (membership replacement is a full `memberIds` array, not a delta).
  Deleting a group or removing/leaving a member is blocked while any balance in
  the group is unsettled
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
3. **Generate two secrets** — `API_KEY` (gates the `/docs` page) and `JWT_SECRET`
   (signs auth tokens). Anything long, random, and different from each other works,
   e.g. `openssl rand -hex 32` run twice.
4. **Generate a Gmail App Password** — group invitation emails send through Gmail's
   SMTP relay using your own Gmail account, so no domain or third-party mail
   provider is needed. This requires 2-Step Verification to be turned on for the
   Google account first (**myaccount.google.com/security**), then generate an App
   Password at **myaccount.google.com/apppasswords**. `GMAIL_USER` is that Gmail
   address; `GMAIL_APP_PASSWORD` is the 16-character password it generates (spaces
   don't matter). Regular Gmail accounts are capped at 500 sends/day, which is
   fine at this scale.
5. **Deploy to Render.** Sign up at [render.com](https://render.com) (free tier),
   click **New +** → **Blueprint**, and connect your fork. Render reads
   [`render.yaml`](render.yaml) automatically and provisions the service — build
   command, start command, region, and plan are all already defined there. You'll be
   prompted for the five secrets it doesn't store in the file: `DATABASE_URL` (from
   step 2), `API_KEY` and `JWT_SECRET` (from step 3), and `GMAIL_USER` and
   `GMAIL_APP_PASSWORD` (from step 4).
6. **Note your service URL** once it's live (something like
   `https://your-app.onrender.com`) — the frontend needs it.
7. **Deploy the frontend.** Fork
   [expense-splitter](https://github.com/utkarshutt2706/expense-splitter) and follow
   its own README, pointing it at your backend's URL.
8. If your frontend ends up on a different origin than the default
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

Real per-user authentication: `POST /auth/register` creates an account (name, email,
phone, password), `POST /auth/login` validates credentials, and both return a signed
JWT alongside the user. Every request except `/health`, `/auth/register`, and
`/auth/login` requires that token as `Authorization: Bearer <token>` — tokens are
signed with `JWT_SECRET` and expire after 7 days, with no refresh flow yet.

A user created as a mere expense/split participant (via `POST /users`, e.g. adding a
friend who isn't going to use the app themselves) has no password and can't log in —
only accounts created through `/auth/register` can.

Authorization is enforced at the group level: every group-scoped route (Groups
get/update/delete, and all Expenses/Payments/Balances routes) checks that the
authenticated caller is actually a member of that group, returning `403 Forbidden`
otherwise. `POST /groups` and `GET /groups` are scoped the same way — creating a group
always adds the creator to its members, and listing groups only returns groups the
caller belongs to.

## API documentation

Interactive Swagger docs are served at `/docs` (and the raw spec at `/docs-json`).
Since Swagger's routes are mounted outside Nest's normal request pipeline, they aren't
covered by the JWT guard — instead `/docs` is gated separately by HTTP Basic Auth,
using the `API_KEY` value as the password (username is ignored; this is the only
remaining use of `API_KEY`, unrelated to the main API's auth). Browsers will prompt
for credentials automatically on first visit.

There's also a Postman collection at
[`postman/expense-splitter-api.postman_collection.json`](postman/expense-splitter-api.postman_collection.json) —
import it directly into Postman, set the `baseUrl` collection variable, then run
Auth > Register or Auth > Login once: a saved Test script on both requests copies the
returned token into the `accessToken` collection variable automatically, which every
other request sends as `Authorization: Bearer {{accessToken}}`. Every endpoint has
saved example responses for its success case and every error case it can actually
produce, useful for integrating against the API without needing a running instance to
explore it against. Generated by `postman/generate.js`; if the API surface changes,
update that script and re-run `node postman/generate.js` rather than hand-editing the
JSON.

## Environment variables

- `PORT`
- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `NODE_ENV`
- `FRONTEND_URL` — base URL the invitation email's accept link points at
- `API_KEY` — password for the `/docs` Basic Auth gate (see above)
- `JWT_SECRET` — signs and verifies auth tokens; must be long and random, and
  different from `API_KEY`
- `GMAIL_USER` — the Gmail address group invitation emails are sent from (see above)
- `GMAIL_APP_PASSWORD` — that account's App Password, generated at
  myaccount.google.com/apppasswords (requires 2-Step Verification)

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
