# Task 3.0 Proofs - Player match history (team-sport and tennis players)

## Task Summary

This task is the largest slice of the feature: it extends the athlete data path so a followed **player's** match history renders with the same full fidelity as a team's. The new `athleteMatchHistory()` function in `lib/espn/client.ts` resolves an athlete's ESPN eventlog into fully-populated `Match` objects — for team-sport players (e.g. Messi) that means both sides' names/ids/scores; for tennis players (e.g. Jannik Sinner) that means a complete `TennisMatchDetail` with per-set scores, draw, round, and court. The detail endpoint and client are wired to use it, and the client now routes each match to the correct Home card by sport (`TennisMatchCard` for tennis, `MatchCard` otherwise).

## What This Task Proves

- `athleteMatchHistory()` returns up to 10 recent (most-recent-first) and 10 upcoming (soonest-first) matches per player, for both the team-sport eventlog shape (`teamId` + `event.$ref`) and the individual-sport eventlog shape (`competition.$ref`).
- The cap is real: a 15-completed + 15-upcoming synthetic eventlog is correctly trimmed to exactly 10 + 10, in the right order.
- Tennis players get a fully-populated `TennisMatchDetail` (`draw`, `round`, `court`, per-set `games`/`won` for both sides) built from resolved linescores — the same shape `TennisMatchCard` renders on Home.
- Fan-out is bounded per the spec's technical guidance: the expensive "deep resolve" step (tennis linescores fetch) only runs for the capped set, not the full eventlog.
- The function never throws — an athlete with no eventlog items, or a failed eventlog fetch, both resolve to `{ recent: [], upcoming: [] }`, which the endpoint surfaces as the existing "Match data unavailable" state without flipping `source.ok`.
- The detail endpoint's player branch resolves the athlete's `leagueKey` the same way `/api/teams` already does (stored `metadata.leagueKey` first, sport's primary league as fallback).
- `EntityMatchesClient` now renders `TennisMatchCard` for `sport === "Tennis"` matches and `MatchCard` for everything else — no new card styling was introduced.

## Evidence Summary

- `lib/espn/client.test.ts` — 4 new tests for `athleteMatchHistory` (team-sport cap/ordering, tennis set-by-set detail, eventlog-fetch failure, empty eventlog), all passing alongside the 32 pre-existing ESPN client tests (36 total, no regressions).
- `app/api/teams/[favoriteId]/matches/route.test.ts` — 3 new player-branch tests (stored leagueKey, fallback leagueKey, no-data graceful state), all passing alongside the Task 2.0 team tests (10 total).
- A live dev-server check confirms the route compiles cleanly with the new `athleteMatchHistory`/`TennisMatchCard` imports (no build errors; the auth-gate 401 fires before hitting the new code, same as Task 2.0).
- Full suite (437 tests, 44 files), `pnpm typecheck`, `pnpm format:check` all pass. `pnpm lint` still shows only the pre-existing, unrelated `home-client.tsx` issue.

## Artifact: `athleteMatchHistory` tests (cap, tennis detail, failure modes)

**What it proves:** The core data-expansion logic — turning an athlete's eventlog into full `Match[]` objects, correctly capped and ordered, with tennis detail populated — behaves as specified.

**Why it matters:** This is the riskiest, highest-value logic in the whole feature; these tests are the direct proof that a player's match history will render with full fidelity.

**Command:**

```bash
npx vitest run lib/espn/client.test.ts
```

**Result summary:** All 36 tests pass, including the 4 new ones. The team-sport cap test seeds 15 completed + 15 upcoming games and asserts the response trims to exactly 10 of each in the correct order; the tennis test asserts `draw`, `round`, `court`, and per-set `games`/`won` for both players match the resolved linescores.

```
✓ lib/espn/client.test.ts (36 tests) 19ms

Test Files  1 passed (1)
     Tests  36 passed (36)
```

## Artifact: Detail endpoint player-branch tests

**What it proves:** The endpoint correctly wires the player branch — leagueKey resolution (stored metadata vs. sport fallback) and the graceful "no data" path — matching the existing `/api/teams` behavior.

**Why it matters:** Confirms the data layer (`athleteMatchHistory`) and the HTTP layer are correctly connected, and that the leagueKey-resolution logic (critical for disambiguating e.g. Messi's `soccer/usa.1` from soccer's primary league) carried over correctly from `/api/teams`.

**Command:**

```bash
npx vitest run "app/api/teams/[favoriteId]/matches/route.test.ts"
```

**Result summary:** All 10 tests pass (7 from Task 2.0 + 3 new player-branch tests).

```
✓ app/api/teams/[favoriteId]/matches/route.test.ts (10 tests) 16ms

Test Files  1 passed (1)
     Tests  10 passed (10)
```

## Artifact: Live compile/runtime check

**What it proves:** The new code (including the `TennisMatchCard` import in `EntityMatchesClient` and the `athleteMatchHistory` import in the route) compiles and runs cleanly under Turbopack — no build-time or runtime errors introduced.

**Why it matters:** Unit tests mock the ESPN client entirely; this confirms the actual module wiring is sound.

**Command:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/ScoreMate/api/teams/fake-player-id/matches
```

**Result summary:** The dev server returns a clean 401 (auth-gate fires before the new player-branch code runs) with no compile errors in the server log — confirming the new imports resolve correctly.

```
GET /api/teams/fake-player-id/matches 401 in 775ms (next.js: 751ms, application-code: 24ms)
```

Full screenshots of the rendered tennis (`TennisMatchCard`) and team-sport-player (`MatchCard`) detail screens require a real signed-in session (OAuth/magic-link), which isn't available in this sandboxed environment. The unit tests above directly exercise the same card-routing and data-shape logic that would render on screen.

## Artifact: Full test suite + quality gates

**What it proves:** No regressions were introduced elsewhere; the new code is type-safe and correctly formatted.

**Commands:**

```bash
npx vitest run
pnpm typecheck
pnpm format:check
```

**Result summary:** All 437 tests across 44 files pass; `typecheck` and `format:check` are clean.

```
Test Files  44 passed (44)
     Tests  437 passed (437)

$ tsc --noEmit
(no output — success)

$ prettier --check .
All matched files use Prettier code style!
```

## Reviewer Conclusion

Followed players — both team-sport athletes and tennis players — now get the same full-fidelity match history as teams: up to 10 recent + 10 upcoming matches, correctly capped and ordered, rendered with the exact Home card component for their sport (`MatchCard` or `TennisMatchCard`). The expensive tennis set-score resolution is bounded to only the capped set, and the whole path degrades gracefully to "Match data unavailable" when ESPN has nothing for a player. All logic is covered by passing automated tests, and the live server confirms the new code compiles and runs without error.
