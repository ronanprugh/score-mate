# 12-baseline-performance.md

Baseline performance measurements for Spec 12 — captured 2026-07-15 against the instrumented production deployment (`dpl_7X2LNnqNGG7KyXjBqdjyrL56e7R2`) on `ronanprugh.com/ScoreMate`.

## Measurement Setup

- **Build:** production (`pnpm build && pnpm start` equivalent — Vercel serverless functions)
- **Source:** Vercel runtime logs (server-side, excludes network RTT) + browser `performance.now()` (client-side, includes proxy + RTT)
- **Auth:** Signed-in session with real favorites
- **Favorites profile:** 98 fan-out calls on `/api/home` (19 league keys × 5 dates + 3 tennis-day calls); 7 entities on `/api/teams`
- **Timezone:** `America/Chicago`
- **"Cold"** definition: first request after a fresh serverless instance start (no `unstable_cache` entries populated)
- **"Warm"** definition: 2nd–Nth requests within the same function instance, with cache populated

---

## Baseline Timings (server-side, ms)

### `/api/home` (fanoutCount = 98)

| Run | Server-side (ms) | Notes |
|-----|-----------------|-------|
| Cold (first ever) | 726 | 98 upstream ESPN calls, cache empty |
| Warm 1 (re-nav) | 577 | Cache partially warm |
| Warm 2 | 147 | Cache fully warm |
| Warm 3 | 139 | |
| Warm 4 | 146 | |
| Warm 5 | 127 | |
| Warm 6 | 120 | |

**Cold: 726 ms** | **Warm median (runs 3–7): 133 ms** | **Warm range: 120–147 ms**

### `/api/teams` (7 entities)

| Run | Server-side (ms) | Notes |
|-----|-----------------|-------|
| Cold | 2 417 | 7 ESPN calls, no cache |
| Warm 2 | 271 | |
| Warm 3 | 409 | |
| Warm 4 | 323 | |
| Warm 5 | 337 | |

**Cold: 2 417 ms** | **Warm median (runs 2–5): 330 ms** | **Warm range: 271–409 ms**

### `/api/teams/[id]/matches`

| Run | Server-side (ms) |
|-----|-----------------|
| 1 | 19 |
| 2 | 26 |
| 3 | 20 |
| 4 | 19 |
| 5 | 22 |

**Warm median: 20 ms** | **Range: 19–26 ms**

### `/api/favorites/search?q=arsenal`

| Run | Server-side (ms) |
|-----|-----------------|
| 1 (first) | 44 |
| 2 | 7 |
| 3 | 5 |
| 4 | 5 |
| 5 | 6 |

**First-request: 44 ms** | **Warm median (runs 2–5): 6 ms** | **Warm range: 5–7 ms**

---

## Observed Fan-out Count

`/api/home` emits `fanoutCount: 98` on every request, confirming:

```
19 league keys × 5 dates + 3 tennis-day calls = 98 upstream ESPN fetches (cold)
```

All 98 are executed in parallel via `Promise.allSettled` and wrapped in `unstable_cache`, so warm requests collapse to a cache read.

---

## Bottleneck Analysis

| Endpoint | Cold (ms) | Warm median (ms) | Verdict |
|----------|-----------|-----------------|---------|
| `/api/teams` | **2 417** | **330** | 🔴 Primary bottleneck |
| `/api/home` | 726 | 133 | 🟡 Cold acceptable; warm excellent |
| `/api/teams/[id]/matches` | ~19 | 20 | 🟢 Fast |
| `/api/favorites/search` | 44 | 6 | 🟢 Fast |

### Root cause: `/api/teams` lacks server-side caching

The home aggregator (`lib/home/cache.ts`) wraps every upstream ESPN call in `unstable_cache`, so warm requests serve from process memory in ~1–5 ms each. The teams route (`app/api/teams/route.ts`) calls `teamScheduleForLeague` with no `revalidateSeconds` option and no `unstable_cache` wrapper, meaning **every `/api/teams` request makes 7 live ESPN calls** (one per entity), giving:

- Cold: 2 417 ms (all 7 ESPN calls, fresh start)
- Warm: 271–409 ms (Next.js `fetch` cache may cache `athleteSchedule` player calls at 300 s, but team schedule calls are uncached)

`athleteSchedule` does pass `revalidateSeconds: 300`, but `teamScheduleForLeague` passes no options and hits ESPN on every invocation.

### Ranked candidate optimizations (from spec candidate list)

1. **Add caching to `teamScheduleForLeague`** (fan-out reduction / caching): wrap in `unstable_cache` with a 5-minute TTL or pass `revalidateSeconds: 300` — this directly fixes the 2 417 ms cold and ~330 ms warm on `/api/teams`. Expected outcome: warm ≤ 50 ms (cache read), cold ≤ 500 ms.
2. **Tennis TZ-key fragmentation**: the home cold of 726 ms is already acceptable; tennis fragmentation is a lower-priority refinement.
3. **In-flight coalescing**: no evidence of concurrent duplicate requests from baseline data; low priority.
4. **Polling cost** (`home-client.tsx`): not exercised as a bottleneck; warm home response is 133 ms, well within the 60s poll window.

---

## Proposed Numeric Targets

These are derived from the baseline numbers. They will be confirmed or adjusted by the user at Task 2.5 before any optimization work begins.

| Endpoint | Metric | Current | Proposed Target |
|----------|--------|---------|----------------|
| `/api/home` | Warm median | 133 ms | ≤ 200 ms (maintain) |
| `/api/home` | Cold | 726 ms | ≤ 800 ms (acceptable — no change needed) |
| `/api/teams` | Warm median | 330 ms | **≤ 100 ms** (after caching fix) |
| `/api/teams` | Cold | 2 417 ms | **≤ 600 ms** (after caching fix) |
| `/api/teams/[id]/matches` | Warm median | 20 ms | ≤ 50 ms (maintain) |
| `/api/favorites/search` | Warm median | 6 ms | ≤ 20 ms (maintain) |
| `/api/home` | Fan-out count | 98 | ≤ 98 (no reduction planned) |

---

## Confirmed Targets

Confirmed by user on 2026-07-15.

| Endpoint | Metric | Target |
|----------|--------|--------|
| `/api/home` | Warm median | ≤ 200 ms |
| `/api/home` | Cold | ≤ 800 ms |
| `/api/teams` | Warm median | ≤ 100 ms |
| `/api/teams` | Cold | ≤ 600 ms |
| `/api/teams/[id]/matches` | Warm median | ≤ 50 ms |
| `/api/favorites/search` | Warm median | ≤ 20 ms |

**Selected optimization:** add server-side caching (`revalidateSeconds: 300`) to `teamScheduleForLeague` calls in the teams route. No polling changes, no fan-out reduction — the data does not support those.
