# Contributing

Ideas, feature suggestions, and pull requests are all welcome — this started as a
small trip-expense tool for a group of friends, and it's genuinely useful to hear
what would make it better for other groups too.

## Got an idea but not a PR?

Open an issue describing it. That's just as valuable as code — especially for
anything that changes behavior other people are already relying on, since it's
easier to talk through the approach before anyone writes code.

## Making a change

1. Fork the repo and branch off `main`. Branches in this repo follow `@feat/<short-
   description>` (e.g. `@feat/expenses-create-list`) — not required in a fork, but
   keeps history consistent if you're aiming to upstream the change.
2. Set up local development per the [README](README.md#local-development).
3. Keep changes focused — one logical piece of work per pull request. A bug fix
   doesn't need an unrelated refactor riding along with it.
4. Write tests alongside any new logic, not as a follow-up. CI enforces coverage
   thresholds (`pnpm test:cov`): 80% for statements/functions/lines, 70% for
   branches. The branch threshold is intentionally lower than the others — every
   class using Nest's dependency injection has one structurally unreachable branch
   from TypeScript's decorator-metadata emission (a circular-import safety check
   that can never actually take its other path), so 100% branch coverage isn't a
   meaningful target here. If you're unsure whether a gap is one of these or a real
   miss, ask in the PR.
5. Match the existing code style: Prettier + ESLint (`pnpm format` / `pnpm lint`),
   no comments explaining *what* code does (only non-obvious *why*), no emojis in
   code or commit messages.
6. Run `pnpm build` and `pnpm test:cov` locally before opening the PR — CI runs the
   same checks (`format:check`, `lint`, `build`, `test`) and won't merge if they fail.

## Opening the pull request

- Describe what changed and why, not just what — the "why" is what won't be obvious
  from the diff a year from now.
- CI must pass: formatting, linting, build, and tests with coverage. The Sonar
  quality gate is also required on the canonical repo (`utkarshutt2706/expense-
  splitter-api`) but is optional on your own fork — see the README's
  [Optional: code quality gate](README.md#optional-code-quality-gate-sonarcloud)
  section if you want it on yours too.
- If you're not a maintainer, the PR needs a maintainer review before it can merge
  (enforced by branch protection) — that's normal, not a sign something's wrong.

## Reporting a bug

Open an issue with what you expected, what happened instead, and enough detail to
reproduce it (a specific group/expense scenario is usually enough — no need for
logs or stack traces unless the API returned a `500`).
