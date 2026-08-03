# Progress

## Done

- Users, Groups, Expenses, Payments CRUD
- Group balances: net balance + Simplify Debt–minimized settlements
- Server-side split validation (equal/exact/percentage/shares) against amount + splitType
- JWT auth: `POST /auth/register`, `POST /auth/login`, `Authorization: Bearer <token>` on every other route
- Group-membership authorization: group-scoped routes 403 for non-members; `POST /groups` auto-adds the creator; `GET /groups` scoped to the caller
- Swagger docs at `/docs` (Basic Auth-gated), Postman collection with saved examples for every real response variant
- Render Blueprint deploy, GitHub Actions CI (format/lint/build/test + Sonar), auto-deploy on push to `main`
- README, CONTRIBUTING.md kept in sync with the above

## Pending

- Confirm `JWT_SECRET` is set in the Render dashboard for the deployed service (`sync: false` vars aren't prompted for on blueprint syncs, only initial creation)
- e2e tests against a real database (raised as a future improvement, not started, no deadline)
- `BACKEND_KICKOFF_PROMPT.md` is untracked and now stale (still describes "no per-user auth") — decide whether to update, delete, or leave as personal scratch
