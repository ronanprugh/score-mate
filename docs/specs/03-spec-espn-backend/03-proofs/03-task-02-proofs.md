# Task 02 Proofs — League fan-out + events catalog remap to ESPN keys

## Task Summary

This task proves the homepage aggregator now plans and fans out one ESPN scoreboard call per `(leagueKey, date)` across a widened 5-day UTC window, driven by a new `SUPPORTED_LEAGUES` registry (2 football + 3 basketball + 14 soccer). The events catalog now uses ESPN `{sport}/{league}` keys instead of TheSportsDB numeric ids, and the per-team / per-league fetchers from the old design are gone — ESPN's per-league scoreboard returns every game in the league for a date, so the union of `(leagueKey × date)` results already covers every match a user could care about. Tennis catalog entries (Wimbledon, US Open Tennis) are removed.

Tiered cache TTLs (30s/300s/3600s) were folded into this task because `lib/home/cache.ts` had to be rewritten to match the new `Fetchers` interface — splitting that across two commits would mean shipping a broken intermediate state. T4 still owns the favorites-reset migration and the README release note.

## What This Task Proves

- `SUPPORTED_LEAGUES` lists exactly the v1 set the spec calls for, with unique league keys and no Tennis.
- `aggregateMatchesForUser` fans out exactly `leagueKeys.length × 5 dates` calls per request — verified for a Basketball Team favorite (3 leagues × 5 = 15 calls).
- The widened ±1-day UTC window is preserved; late-night Eastern matches still bucket to the correct local day.
- Partial upstream failures still surface in `source.errors` with `source.ok = false` and successful data still renders.
- The events catalog's `findEventInstanceForMatch` claims a World Cup match by ESPN league key (`soccer/fifa.world`) within the date window, claims the Super Bowl by combined `leagueId` + `leagueNameContains`, and ignores regular-season NFL games on the same day.
- The route handler still wires `auth → parseDates → aggregateMatchesForUser` with the new single-fetcher cache bundle.
- The tiered cache TTL helper (`chooseRevalidate`) returns 30/3600/300 for today/yesterday/tomorrow, and the widened neighbors inherit their owning bucket's TTL.
- All 233 tests pass; typecheck + lint clean.

## Evidence Summary

- `pnpm test:ci` → 28 files, 233 tests, all passing.
- `pnpm typecheck` and `pnpm lint` → clean.
- New tests: 6 in `lib/espn/leagues.test.ts`, 8 in `lib/home/cache.test.ts`.
- Rewritten tests: `lib/home/aggregator.test.ts`, `lib/events-catalog.test.ts`, `app/api/home/route.test.ts`.

## Artifact: Aggregator + leagues + catalog tests pass

**What it proves:** The new fan-out plan, the league registry, and the catalog remapping all behave per spec.

**Command:**

```bash
pnpm test:ci lib/espn/leagues.test.ts lib/home/aggregator.test.ts lib/home/cache.test.ts lib/events-catalog.test.ts
```

**Result summary:** 4 test files, all green.

```
 ✓ lib/espn/leagues.test.ts (6 tests)
 ✓ lib/home/aggregator.test.ts (13 tests)
 ✓ lib/home/cache.test.ts (8 tests)
 ✓ lib/events-catalog.test.ts (11 tests)
```

## Artifact: Full test suite still green

**What it proves:** The aggregator interface change (`eventsDay`/`eventsTeam`/`eventsLeague` → single `eventsLeagueDay`) and the events-catalog remap did not regress anything else.

**Command:**

```bash
pnpm test:ci
```

**Result summary:** 28 files, 233 tests, all passed in 4.68s.

```
 Test Files  28 passed (28)
      Tests  233 passed (233)
   Duration  4.68s
```

## Artifact: Typecheck and lint clean

**Command:**

```bash
pnpm typecheck && pnpm lint
```

**Result summary:** Both commands exit 0 with no diagnostics.

```
$ tsc --noEmit
$ eslint
```

## Reviewer Conclusion

The aggregator now speaks ESPN's per-league scoreboard model end-to-end, the events catalog points at ESPN league keys, and the cache layer is tiered by bucket. The route handler is unchanged in contract. Manual dev-server verification is scheduled for T5.0; this task's scope is the code path and its unit tests, both of which are green.

## Notes on Scope Adjustment

- The tiered cache TTL implementation (originally T4.1) was folded into this task because `lib/home/cache.ts` had to be rewritten to satisfy the new `Fetchers` interface. The remaining T4 work (favorites-reset migration, README release note) is unchanged.
- The per-team and per-league fetchers from the old aggregator are gone entirely. ESPN's per-league scoreboard is lossless within its league/date window, so the previous union-with-per-team trick (a TheSportsDB workaround) is unnecessary.
