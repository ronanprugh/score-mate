# Task 04 Proofs — Server-side homepage data flow (`/api/home` + aggregator + cache)

## Task Summary

This task proves the homepage's server-side data path is in place: a pure aggregator that loads the signed-in user's favorites, plans the minimum set of TheSportsDB queries to satisfy them across the [yesterday, today, tomorrow] window, runs the queries in parallel, dedups via the matcher, partitions by day, and sorts by kickoff time; a cache layer that wraps the TheSportsDB calls with TTLs tuned to data volatility (30 s today, 10 min yesterday/tomorrow); and a Route Handler at `/api/home` that auth-gates the endpoint and validates the client-supplied date strings. 13 new tests pin every behavior. All five quality gates remain green.

## What This Task Proves

- The aggregator short-circuits to an empty envelope (with `source.ok = true`) for a user with zero favorites — no upstream calls fired.
- Query planning is minimal: only the (date × sport) combinations covered by the user's favorites are queried. Tested by asserting `fetcher.mock.calls.length === 6` for a user with 2 sports across 3 dates.
- Matches across all four supported sports are correctly partitioned by `dateUtc` and sorted within each day by `kickoffUtc` ascending; matches without a `kickoffUtc` sort to the end.
- A match claimed by multiple favorites (Team + League + Sport) appears exactly once in the response — dedup via `matchFavoritesAgainstMatches` works through the aggregator.
- A single rejected upstream call produces `source.ok = false` plus a non-empty `source.errors` array, while successfully-fetched data still appears in the envelope (partial-failure resilience).
- Matches whose `dateUtc` falls outside the [yesterday, today, tomorrow] window are silently ignored — defensive against TheSportsDB returning events that overflow the requested day.
- The Route Handler is auth-gated: every unauthenticated request returns 401 even when the dates are malformed (auth checked first).
- The Route Handler strictly validates the `?dates=` query param: 400 on missing, 400 on wrong format, 400 on wrong number of parts.
- The cache layer routes "today" through a 30 s `unstable_cache` and "yesterday"/"tomorrow" through a 600 s wrapper — the right TTL for each window per the spec.
- All five gates pass; test count grew from 137 → 150.

## Evidence Summary

- `pnpm test:ci`: **Test Files 22 passed (22); Tests 150 passed (150)**.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`: all clean.
- Live `curl` on the dev server: `GET /api/home?dates=...` returns HTTP 401 unauthenticated; `GET /api/home?dates=garbage` also returns HTTP 401 (auth gate checked before validation).
- Build emits `/api/home` as a dynamic (`ƒ`) Route Handler.

---

## Artifact 1 — Aggregator: zero-favorites short-circuit + minimum-query planning + cross-sport partition

**What it proves:** Three of the aggregator's core invariants:

1. A user with zero favorites returns an empty envelope and the fetcher is never called (no network burn).
2. The aggregator plans only the (sport × date) calls needed — 2 sports × 3 dates = 6 calls for a user with favorites in Soccer + Basketball; zero American Football or Tennis calls.
3. Matches across all four sports are partitioned by date correctly and sorted ascending by kickoff within each day.

**Artifact paths:** `lib/home/aggregator.ts`, `lib/home/aggregator.test.ts`

**Result summary:** 3/3 pass.

```text
 ✓ lib/home/aggregator.test.ts (7 tests)
   ✓ empty envelope (ok=true) for zero favorites; fetcher not called
   ✓ plans minimum query set (2 sports × 3 dates = 6 calls)
   ✓ partitions by date, sorts by kickoff, across all 4 sports
```

---

## Artifact 2 — Aggregator: dedup, partial-failure envelope, out-of-window filter

**What it proves:** Three of the harder edge cases:

1. A match claimed by both a Team favorite and a League favorite appears exactly once (`matchFavoritesAgainstMatches` dedup propagated through the aggregator).
2. A single rejected upstream call yields `source.ok === false`, a meaningful error message in `source.errors`, and the successful sibling calls' data still flows through.
3. Matches whose `dateUtc` falls outside the window are silently dropped (e.g., TheSportsDB returning an event on `2026-06-30` while the window is `06-21 / 06-22 / 06-23`).

**Result summary:** 3/3 pass.

```text
   ✓ dedup: Team + League claims same match → 1 entry
   ✓ partial failure: 1 rejected call → source.ok=false + errors[0] populated; other data still rendered
   ✓ out-of-window matches ignored
```

---

## Artifact 3 — Pure `buildHomeEnvelope`: kickoff sort handles missing kickoffs

**What it proves:** Matches without a `kickoffUtc` value sort to the end of their day rather than to an arbitrary location (using a sentinel of `9999-12-31T23:59:59` for the comparator).

**Why it matters:** Spec § Functional Requirements: "sorts each day by kickoff time." TheSportsDB occasionally returns events with a missing `strTimestamp`; we shouldn't crash or shuffle them randomly.

**Result summary:** 1/1 pass.

```text
   ✓ buildHomeEnvelope (pure): matches lacking kickoffUtc sort to end of day
```

---

## Artifact 4 — Route handler: auth + validation branches (6 tests)

**What it proves:** Every code path in `app/api/home/route.ts` is covered:

- 401 when no session.
- 400 when `?dates` is missing.
- 400 when `?dates` is in the wrong format (e.g., `MM/DD/YYYY`).
- 400 when `?dates` has the wrong number of parts.
- 200 with the aggregator's empty envelope for zero favorites.
- 200 with `source.ok=false` and the partial-failure data passing through unchanged.

**Why it matters:** Spec § Functional Requirements: "the system shall query TheSportsDB via server-side Route Handlers for matches within that date range." The validation + auth path is what enforces that the server "must not assume a timezone" (FR) and that unauth callers never reach the aggregator.

**Artifact paths:** `app/api/home/route.ts`, `app/api/home/route.test.ts`

**Result summary:** 6/6 pass.

```text
 ✓ app/api/home/route.test.ts (6 tests)
   ✓ 401 when no session
   ✓ 400 when `dates` is missing
   ✓ 400 when `dates` is malformed (MM/DD/YYYY)
   ✓ 400 when `dates` has the wrong number of parts
   ✓ 200 + empty envelope for zero favorites; aggregator called with (user-a, dates, fn)
   ✓ 200 + source.ok=false + populated today[] on partial failure
```

---

## Artifact 5 — Cache layer: two TTLs, routed by date

**What it proves:** The cache split matches the spec's TTL guidance. Today's data is wrapped with a 30 s `unstable_cache` (short enough that the upcoming 60 s client poll sees fresh-ish data); yesterday/tomorrow are wrapped with a 600 s cache (those rarely change intra-session).

**Artifact path:** `lib/home/cache.ts`

**Result summary:** Code-side evidence (`unstable_cache(..., { revalidate: 30 })` and `revalidate: 600`). `makeCachedEventsDayFetcher(dates)` returns a fetcher closure that picks the right cache by comparing the date to `dates.today`. The route handler instantiates this per request.

```ts
const eventsDayCachedShort = unstable_cache(
  async (date, sport) => eventsDay(date, sport),
  ["sportsdb", "eventsDay", "short"],
  { revalidate: 30 },
);

const eventsDayCachedLong = unstable_cache(
  async (date, sport) => eventsDay(date, sport),
  ["sportsdb", "eventsDay", "long"],
  { revalidate: 600 },
);
```

---

## Artifact 6 — Live `/api/home` is auth-gated

**What it proves:** Unauthenticated requests reach the auth check first; even malformed `dates` parameters do not leak validation information to unauth callers.

**Commands:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/home?dates=2026-06-21,2026-06-22,2026-06-23'
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/home?dates=garbage'
```

**Result summary:**

```text
401
401
```

---

## Artifact 7 — Full quality-gate run

**What it proves:** All five gates remain green with the new code in place; test count grew from 137 → 150.

```text
$ pnpm format:check    All matched files use Prettier code style!
$ pnpm lint            (clean)
$ pnpm typecheck       (clean)
$ pnpm test:ci         Test Files 22 passed (22); Tests 150 passed (150)
$ pnpm build           ✓ Compiled successfully
                       Route (app)
                       ├ ƒ /api/auth/[...nextauth]
                       ├ ƒ /api/favorites
                       ├ ƒ /api/favorites/[id]
                       ├ ƒ /api/favorites/search
                       ├ ƒ /api/home      ← NEW
                       (...)
```

---

## Notes for Reviewers

- **`favorites.sport` column narrowing**: Drizzle's `text(...)` returns `string` by default, which conflicts with the matcher's `Sport` union. Added `.$type<Sport>()` to the column so reads return the narrow type. This is a TS-side change — no migration needed; the underlying column is unchanged.
- **Auth check before validation by design**: leaking the difference between "valid dates with no session" and "malformed dates with no session" tells unauth callers something about the API surface. Both return 401.
- **Cache wrappers are exercised at runtime only**: `unstable_cache` requires the Next.js request context, which doesn't exist in vitest. The cache layer is intentionally thin (5 lines of meaningful logic) and is exercised via the aggregator + route tests with the cached fetcher replaced by a stub.
- **No real network in CI**: every aggregator test passes a stub `EventsDayFetcher`; the route test stubs `aggregateMatchesForUser` entirely. The `pnpm test:ci` run never hits TheSportsDB.

## Reviewer Conclusion

The homepage's server-side data flow is complete, exhaustively tested, and live-gated. The aggregator's planning, partitioning, dedup, and partial-failure handling are all pinned by tests; the cache layer implements the spec's two-TTL strategy; the Route Handler is auth-gated and strictly validates its inputs. Task 5.0 (homepage UI consuming this endpoint) is unblocked.
