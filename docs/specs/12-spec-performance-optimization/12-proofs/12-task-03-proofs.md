# Task 03 Proofs — Add caching to `teamScheduleForLeague` call sites

## Task Summary

Based on the Task 2.0 baseline, `/api/teams` was identified as the primary bottleneck (cold 2 417 ms, warm 330 ms) due to `teamScheduleForLeague` making a live ESPN request on every invocation with no caching. This task adds `{ revalidateSeconds: 300 }` to both `teamScheduleForLeague` call sites, matching the TTL already used by `athleteSchedule`.

## What This Task Proves

- The optimization selected by baseline measurement: add `revalidateSeconds: 300` to `teamScheduleForLeague` calls.
- Both call sites patched: `app/api/teams/route.ts` (entity card schedule) and `app/api/teams/[favoriteId]/matches/route.ts` (match history).
- All 461 tests pass; typecheck and format are clean; no behavior changes.
- The function already accepted `ClientOptions` — the change is two lines, one per call site.

## Evidence Summary

- `teamScheduleForLeague` already typed `opts: ClientOptions = {}` and forwarded to `fetchJson`; only the callers needed updating.
- 461/461 tests pass; typecheck exits 0; `prettier --check` all files clean.
- After-state timings captured in Task 4.0.

## Artifact: diff — optimization change

**What it proves:** The change is minimal — two call sites receive `{ revalidateSeconds: 300 }`. No behavioral change; team schedule data is now cached for 5 minutes in the Next.js fetch cache, matching `athleteSchedule`.

**Why it matters:** FR 2.1 requires the optimization be selected from baseline evidence; FR 2.3 requires tests still pass.

```diff
--- a/app/api/teams/route.ts
+++ b/app/api/teams/route.ts
     const schedule = await teamScheduleForLeague(
       catalogTeam.leagueKey,
       fav.externalId,
+      { revalidateSeconds: 300 },
     );

--- a/app/api/teams/[favoriteId]/matches/route.ts
+++ b/app/api/teams/[favoriteId]/matches/route.ts
         const schedule = await teamScheduleForLeague(
           catalogTeam.leagueKey,
           favorite.externalId,
+          { revalidateSeconds: 300 },
         );
```

## Artifact: full quality gates

**What it proves:** Optimization adds no type errors, test failures, or formatting issues (FR 2.3, 2.4).

**Commands:**

```bash
pnpm test:ci && pnpm typecheck && pnpm format:check
```

**Result summary:** 461/461 tests pass across 46 test files; `tsc --noEmit` exits 0; all files Prettier-conformant.

```
 Test Files  46 passed (46)
      Tests  461 passed (461)

$ tsc --noEmit
(no output — exit 0)

Checking formatting...
All matched files use Prettier code style!
```

> Note: The pre-existing `@next/next/no-html-link-for-pages` lint error in `home-client.tsx` is unchanged.

## Reviewer Conclusion

Adding `revalidateSeconds: 300` to `teamScheduleForLeague` is a two-line change that brings team schedule caching in line with `athleteSchedule`. After-state timings (Task 4.0) will confirm the reduction from 2 417 ms cold / 330 ms warm toward the confirmed targets of ≤ 600 ms cold / ≤ 100 ms warm.
