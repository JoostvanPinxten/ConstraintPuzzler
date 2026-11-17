---
name: test
description: Run the full ConstraintPuzzler check suite (typecheck, ESLint/Prettier, vitest + jest unit tests, Playwright browser tests) as CI does, and summarise the results.
---

Run these from the repository root, in order. Keep going after a failure, so the summary covers every step.

1. `npm ci` (only when `node_modules` is missing or `package-lock.json` changed)
2. `npm run typecheck` (tsc for packages/core and app)
3. `npm run lint` (ESLint, then `prettier --check`)
4. `npm test` (vitest for packages/core, including the golden fixtures and the coverage thresholds in
   `packages/core/vitest.config.ts`; jest for app)
5. `npm run export:web -w @constraintpuzzler/app` then `npx playwright test` (the web build in Chromium, at
   desktop and phone sizes; run `npx playwright install chromium` once if the browser is missing)

Then report a short table with each step, pass/fail, and counts (tests passed/skipped/failed per runner;
core statement coverage). For each failure, quote the relevant error lines and propose (don't apply) a fix,
unless the user asked you to fix things. Formatting failures are fixed with `npm run format`.

The desktop (Tauri) and Android builds need Rust and the Android SDK; CI builds them
(`.github/workflows/app-builds.yml`). Don't try them locally unless asked.
