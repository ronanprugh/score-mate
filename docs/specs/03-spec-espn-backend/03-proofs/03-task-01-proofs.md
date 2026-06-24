# Task 01 Proofs — ESPN client module + provider-neutral types

## Task Summary

This task proves that score-mate now has a working ESPN site-v2 client module (`lib/espn/`) that returns the same internal `Match`/`Team`/`League` shapes the rest of the app already consumes, and that the internal types have been relocated to a provider-neutral path (`lib/sports/types.ts`). The old `lib/sportsdb/` module remains in place during T2/T3 and will be deleted in T3.9 once its last callers (cache.ts and the search route) are rewritten. Tennis stays in the `Sport` union for the same reason — removing it now would break typecheck in code paths that get deleted/rewritten in the next two tasks.

## What This Task Proves

- The new `lib/espn/client.ts` exposes `scoreboardForLeague`, `leagueTeams`, `teamScheduleForLeague`, and an opt-in `fetchEventCoreDetail` fallback into `sports.core.api.espn.com`.
- ESPN's `event.status.type.state` (`pre`/`in`/`post`) maps cleanly to the internal `upcoming`/`live`/`final` enum.
- ESPN's ISO 8601 `date` field with explicit `Z` parses directly into `kickoffUtc` — no legacy timezone-suffix workaround needed.
- Empty / missing `events` arrays return `[]` rather than throwing.
- Non-2xx upstream responses throw a descriptive error that includes the URL and status.
- The provider-neutral types live at `lib/sports/types.ts` and every importer is migrated.
- All 210 pre-existing tests still pass.

## Evidence Summary

- `pnpm test:ci` → 26 files, 210 tests, all passing (22 new in `lib/espn/client.test.ts`).
- `pnpm typecheck` and `pnpm lint` → both clean.
- `git diff --stat` confirms `lib/espn/` and `lib/sports/types.ts` added; existing importers updated to the new types path; `lib/sportsdb/` intentionally left in place (deleted in T3.9).

## Artifact: ESPN client tests pass

**What it proves:** The new module's behavior — URL building, status/score mapping, kickoff parsing, empty/error handling, sport key filtering — is fully covered.

**Why it matters:** The aggregator (T2) and search-route (T3) consume these functions directly; a regression here would cascade through the whole homepage.

**Command:**

```bash
pnpm test:ci lib/espn/client.test.ts
```

**Result summary:** 22 of 22 tests passed in 7ms.

```
 ✓ lib/espn/client.test.ts (22 tests) 7ms

 Test Files  1 passed (1)
      Tests  22 passed (22)
```

## Artifact: Full test suite still green

**What it proves:** Migrating `@/lib/sportsdb/types` → `@/lib/sports/types` across 15 importer files did not regress anything.

**Why it matters:** The type-path migration touches schema, aggregator, components, and route handlers; this is the safety net.

**Command:**

```bash
pnpm test:ci
```

**Result summary:** 26 files, 210 tests, all passed in 4.46s. No skipped tests.

```
 Test Files  26 passed (26)
      Tests  210 passed (210)
   Duration  4.46s
```

## Artifact: Typecheck and lint clean

**What it proves:** The Sport union, the new client, and the migrated imports all compile under strict TypeScript, and pass the Next.js + Prettier-compat ESLint config.

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

The ESPN client module is built, tested, and integrated into the type system. The provider-neutral types path is established. No existing behavior is regressed. The remaining cleanups (delete `lib/sportsdb/`, drop Tennis, residue grep) are intentionally deferred to T3.9 where they can land atomically once the last `lib/sportsdb/` caller is rewritten.

## Notes on Deferred Sub-Tasks

T1.3, T1.11, T1.12 are explicitly deferred to **T3.9** (new sub-task added to Task 3). Rationale:

- Dropping Tennis from `Sport` while `lib/sportsdb/client.ts` still references it would fail typecheck.
- Deleting `lib/sportsdb/` while `lib/home/cache.ts` and `app/api/favorites/search/route.ts` still import from it would fail typecheck.
- Both rewrites are scheduled in T2 and T3 respectively, so the cleanup naturally falls into a single atomic commit at the end of T3.

The task-file diff and the audit reflect this re-ordering. End state is identical to the original plan.
