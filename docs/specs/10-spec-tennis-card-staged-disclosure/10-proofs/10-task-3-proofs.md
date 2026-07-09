# Task 3 Proofs - Quality gates & end-to-end proof capture

## Task Summary

This task runs the full CI-equivalent gate set — lint, format check,
typecheck, the complete test suite, and a production build — against the
staged-disclosure change from Tasks 1.0 and 2.0, exactly as `.github/workflows/ci.yml`
would. It confirms the feature is mergeable as-is with no regressions
anywhere in the app, and closes out the spec's default-compactness success
metric.

## What This Task Proves

- Every repository quality gate (`lint`, `format:check`, `typecheck`,
  `test:ci`, `build`) passes cleanly on the full working tree, not just the
  files touched by this feature.
- The client-component change (`TournamentCard`, new `useState`, new pure
  module) introduces no build-time or type regressions.
- The default-compactness success metric — a tournament card renders no
  discipline sections until activated — holds.

## Evidence Summary

- `pnpm lint`: 0 errors (2 pre-existing warnings in files untouched by this
  spec).
- `pnpm format:check`: all files match Prettier style.
- `pnpm typecheck`: `tsc --noEmit` completes with no errors.
- `pnpm test:ci`: 423/423 tests pass across 42 test files.
- `pnpm build`: production build completes successfully, including the
  `/dev-fixture/tennis-day` route used for manual verification.

## Artifact: Full quality gate run (lint, format, typecheck, test)

**What it proves:** The entire repository — not just this feature's files —
passes every automated quality check CI would run.

**Why it matters:** This is the exact gate sequence `.github/workflows/ci.yml`
runs (`lint` → `format:check` → `typecheck` → `test:ci` → `build`); a green
run here means the PR is expected to pass CI without surprises.

**Command:**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci
```

**Result summary:** All four gates passed. Lint reported 0 errors (2
warnings, both pre-existing and in files unrelated to this spec:
`lib/espn/tennis.test.ts` and `scripts/verify-tennis-endpoints.ts`). Format
check reported all files match Prettier style. Typecheck produced no output
(success). The full test suite passed 423/423 tests across 42 files in
~6.2s.

```text
$ pnpm lint
✖ 2 problems (0 errors, 2 warnings)

$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!

$ pnpm typecheck
$ tsc --noEmit
(no output — success)

$ pnpm test:ci
 Test Files  42 passed (42)
      Tests  423 passed (423)
   Duration  6.21s
```

## Artifact: Production build

**What it proves:** The staged-disclosure change compiles and statically
analyzes correctly under `next build`, including the dev-fixture route used
for manual verification, with no TypeScript or build errors.

**Why it matters:** `pnpm test:ci` runs under Vitest/jsdom and doesn't
exercise the real Next.js build pipeline; a clean `pnpm build` is the
strongest signal the change is deployable.

**Command:**

```bash
pnpm build
```

**Result summary:** Build compiled successfully in 2.4s, TypeScript checking
finished with no errors, and all 20 routes (including
`/dev-fixture/tennis-day`) were generated/collected without failure.

```text
$ next build
✓ Compiled successfully in 2.4s
  Running TypeScript ...
  Finished TypeScript in 2.4s ...
✓ Generating static pages using 7 workers (20/20) in 184ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/favorites
├ ƒ /api/favorites/[id]
├ ƒ /api/favorites/search
├ ƒ /api/home
├ ƒ /api/teams
├ ƒ /auth/error
├ ○ /check-email
├ ƒ /dev-fixture/nav
├ ○ /dev-fixture/player-search
├ ○ /dev-fixture/tennis-day
├ ○ /dev-fixture/tennis-search
├ ƒ /favorites
├ ƒ /home
├ ƒ /my-favorites
├ ƒ /settings
├ ○ /signin
└ ƒ /teams
```

## Artifact: Default-compactness verification (collapsed by default)

**What it proves:** A rendered tournament card shows zero discipline
sections until the user activates it — the spec's primary success metric.

**Why it matters:** This is the headline behavior change the whole spec
exists to deliver; it's already covered by the automated test `(b)` in
`tournament-card.test.tsx` (Task 2.0) and reconfirmed here as part of the
end-to-end gate pass, plus the live browser check documented in
[`10-task-2-proofs.md`](10-task-2-proofs.md) which showed the
`/dev-fixture/tennis-day` card rendering with only its header (name, date
range, counts, chevron) and zero `match-group` sections at initial load.

**Result summary:** `pnpm test:ci` (this task) re-confirms test `(b)`
("collapsed by default: renders zero discipline sections") passes as part
of the full 423/423 green suite; the corresponding live-browser evidence is
in Task 2.0's proof file to avoid duplicating the same screenshot narrative
here.

## Reviewer Conclusion

The staged-disclosure feature passes every repository quality gate exactly
as CI would run them — lint, format, typecheck, the full 423-test suite, and
a production build — with zero errors and zero regressions. Combined with
the component and live-browser evidence in Tasks 1.0 and 2.0, this confirms
the implementation is complete, correct, and ready for review.
