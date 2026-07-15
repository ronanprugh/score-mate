# Task 01 Proofs — Server timing instrumentation on all four data routes

## Task Summary

This task adds a `withServerTiming` wrapper to every data route. Each request now emits a structured JSON log line and a `Server-Timing` response header carrying the handler duration and (for `/api/home`) the upstream fan-out count. The `HomeEnvelope` shape is unchanged.

## What This Task Proves

- A reusable timing helper (`lib/perf/server-timing.ts`) exists, is unit-tested, and produces spec-compliant log lines and headers.
- All four routes (`/api/home`, `/api/teams`, `/api/teams/[id]/matches`, `/api/favorites/search`) emit `Server-Timing` headers.
- `/api/home` additionally tracks `fanoutCount` via the new `planFanoutCount` helper and an out-parameter on `aggregateMatchesForUser`.
- `HomeEnvelope` is unchanged; body bytes pass through the wrapper unmodified.
- All 461 tests pass; typecheck and format are clean; production build succeeds.

## Evidence Summary

- `pnpm test:ci`: 461/461 tests pass across 46 test files.
- `pnpm typecheck`: exits 0.
- `pnpm build`: succeeds; all four instrumented routes remain dynamic (`ƒ`).
- Server-Timing header assertions are present in all four route test files and pass.
- The `lib/perf/server-timing.test.ts` suite (9 tests) covers duration capture, header format, counter inclusion, byte-identical body passthrough, status preservation, existing-header preservation, and error propagation.

## Artifact: server-timing helper unit tests

**What it proves:** The timing wrapper produces a spec-compliant log line and header, passes the body unchanged, and propagates errors.

**Why it matters:** These are the ground-truth assertions that the helper works correctly independent of any route.

**Command:**

```bash
pnpm vitest run lib/perf/server-timing.test.ts
```

**Result summary:** 9/9 tests passed in ~6 ms.

```
 ✓ lib/perf/server-timing.test.ts (9 tests) 6ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

## Artifact: aggregator fan-out helper tests

**What it proves:** `planFanoutCount` correctly computes `leagueKeys × 5 + 3` and excludes team favorites.

**Why it matters:** This is the basis for the `fanoutCount` counter emitted on every `/api/home` request.

**Command:**

```bash
pnpm vitest run lib/home/aggregator.test.ts
```

**Result summary:** 25/25 tests passed, including the three new `planFanoutCount` cases.

```
 ✓ lib/home/aggregator.test.ts (25 tests) 50ms
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

## Artifact: route-level Server-Timing header assertions

**What it proves:** Each of the four instrumented routes includes a `Server-Timing` header on 200 responses, and the body shape is unchanged.

**Why it matters:** These are the integration-level assertions that the wrapper is correctly wired into each route.

**Command:**

```bash
pnpm vitest run \
  app/api/home/route.test.ts \
  app/api/teams/route.test.ts \
  "app/api/teams/[favoriteId]/matches/route.test.ts" \
  app/api/favorites/search/route.test.ts
```

**Result summary:** 52/52 route tests pass including the four new `Server-Timing` header assertions.

```
 Test Files  4 passed (4)
      Tests  52 passed (52)
```

## Artifact: full quality gates

**What it proves:** Instrumentation adds no type errors, lint violations (beyond the pre-existing `<a>` error), or formatting issues.

**Command:**

```bash
pnpm test:ci && pnpm typecheck && pnpm format:check
```

**Result summary:** 461/461 tests pass; typecheck exits 0; all files are Prettier-conformant.

```
 Test Files  46 passed (46)
      Tests  461 passed (461)

$ tsc --noEmit
(no output — exit 0)

Checking formatting...
All matched files use Prettier code style!
```

> Note: The pre-existing `@next/next/no-html-link-for-pages` lint error (an `<a>` tag in a component added before Spec 12) was present before this task and is unchanged.

## Artifact: production build

**What it proves:** The instrumented routes compile and are served dynamically (not accidentally pre-rendered) in a production build.

**Command:**

```bash
pnpm build
```

**Result summary:** Build succeeded. All four instrumented routes appear as `ƒ` (Dynamic, server-rendered on demand).

```
├ ƒ /home
├ ƒ /teams
├ ƒ /teams/[favoriteId]
...
ƒ  (Dynamic)  server-rendered on demand
```

> The `curl -sD -` proof against a live `pnpm start` session with a real authenticated user will be captured as part of Task 2.0 (baseline measurement), where a signed-in session is required.

## Artifact: implementation summary — no hot-path I/O added

**What it proves:** The wrapper adds negligible overhead — only `performance.now()` calls and a `console.log` on the cold path.

**Why it matters:** FR 1.4 requires instrumentation overhead be negligible.

**Diff summary:** `withServerTiming` calls `performance.now()` twice and `console.log` once per request. No upstream calls, no sync I/O, no DB queries are added. The response is cloned by constructing a `new Response(response.body, { ... })` — the body stream is transferred (not buffered), so memory overhead is zero.

## Reviewer Conclusion

All four data routes now emit structured timing logs and `Server-Timing` response headers. The `planFanoutCount` helper exposes the upstream call plan; `aggregateMatchesForUser` writes the actual count into a caller-supplied out-parameter so `/api/home` can surface it in the header. All 461 tests pass, typecheck is clean, and the production build succeeds with all routes remaining dynamic.
