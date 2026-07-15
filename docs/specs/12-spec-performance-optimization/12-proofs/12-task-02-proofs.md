# Task 02 Proofs — Baseline performance report and confirmed targets

## Task Summary

This task captures cold-cache and warm-cache timings for all four instrumented endpoints against the production build, identifies the highest-cost bottleneck, and presents proposed numeric targets to the user for confirmation.

## What This Task Proves

- Server-side timing was measurable in production via Vercel runtime logs (structured JSON emitted by `withServerTiming`).
- `/api/home` is well-optimized (warm median 133 ms) due to `unstable_cache` wrapping in `lib/home/cache.ts`.
- `/api/teams` is the primary bottleneck (cold 2 417 ms, warm 330 ms) due to uncached `teamScheduleForLeague` calls — one live ESPN request per entity per invocation.
- Confirmed numeric targets recorded in `12-baseline-performance.md` after user approval.

## Evidence Summary

- Cold `/api/home`: 726 ms server-side, fanoutCount=98 (confirmed via Vercel runtime log).
- Warm `/api/home` median (runs 3–7): 133 ms server-side.
- Cold `/api/teams`: 2 417 ms server-side (7 uncached ESPN calls).
- Warm `/api/teams` median (runs 2–5): 330 ms server-side.
- `/api/teams/[id]/matches` warm: 20 ms; `/api/favorites/search` warm: 6 ms — both fast.
- User confirmed targets on 2026-07-15.

## Artifact: Vercel runtime log — cold `/api/home`

**What it proves:** The `withServerTiming` wrapper emits structured JSON with duration and fanout count on every production request (FR 1.5).

**Why it matters:** This is the authoritative cold-cache baseline — taken from the first request after a fresh serverless instance start.

**Source:** Vercel runtime logs, deployment `dpl_7X2LNnqNGG7KyXjBqdjyrL56e7R2`.

**Result summary:** Cold duration 726 ms, fanout 98 upstream ESPN calls.

```
18:27:43 GET /ScoreMate/api/home 200 [info/serverless]
    {"route":"home","durationMs":726,"counters":{"fanoutCount":98}}
```

## Artifact: Vercel runtime log — warm `/api/home` (6 runs)

**What it proves:** After cache population, `/api/home` returns in 120–147 ms regardless of fanout=98.

**Result summary:** Warm median 133 ms; all 98 upstream calls served from `unstable_cache`.

```
18:29:57  {"route":"home","durationMs":577}  ← first re-nav (partial warm)
18:29:58  {"route":"home","durationMs":147}
18:29:58  {"route":"home","durationMs":139}
18:29:59  {"route":"home","durationMs":146}
18:29:59  {"route":"home","durationMs":127}
18:29:59  {"route":"home","durationMs":120}
```

## Artifact: Vercel runtime log — cold and warm `/api/teams`

**What it proves:** `/api/teams` is 3.3× slower cold than `/api/home` despite only 7 upstream calls, confirming the absence of caching as the root cause.

**Result summary:** Cold 2 417 ms (7 uncached ESPN calls); warm 271–409 ms (relies on Next.js fetch cache for player endpoints only; team schedule calls remain uncached).

```
18:30:20  {"route":"teams","durationMs":2417}   ← cold
18:30:23  {"route":"teams","durationMs":271}
18:30:23  {"route":"teams","durationMs":409}
18:30:24  {"route":"teams","durationMs":323}
18:30:24  {"route":"teams","durationMs":337}
```

## Artifact: Vercel runtime log — `/api/teams/[id]/matches` and `/api/favorites/search`

**What it proves:** Both secondary endpoints are fast and not bottlenecks.

```
teams-matches: 19, 26, 20, 19, 22 ms (warm median 20 ms)
favorites-search: 44, 7, 5, 5, 6 ms (warm median 6 ms)
```

## Artifact: `12-baseline-performance.md`

**What it proves:** Full baseline document with cold/warm tables, bottleneck analysis, and confirmed targets exists at the required path.

**Artifact path:** `docs/specs/12-spec-performance-optimization/12-baseline-performance.md`

**Result summary:** Document covers all four endpoints, identifies `/api/teams` as the primary bottleneck due to uncached `teamScheduleForLeague`, ranks candidate optimizations, and records confirmed numeric targets.

## Reviewer Conclusion

The baseline shows `/api/home` is already well-optimized at 133 ms warm (98 fan-out, fully cached), while `/api/teams` is 2.4 seconds cold and 330 ms warm for only 7 entities — a direct consequence of `teamScheduleForLeague` making live ESPN calls on every invocation. The confirmed targets (`/api/teams` warm ≤ 100 ms, cold ≤ 600 ms) are achievable by adding `revalidateSeconds: 300` to the two `teamScheduleForLeague` call sites, implemented in Task 3.0.
