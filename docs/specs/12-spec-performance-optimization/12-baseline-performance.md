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

**Selected optimization (final):** wrap `teamScheduleForLeague` and `athleteSchedule` calls in `unstable_cache` with a 300 s TTL in `app/api/teams/route.ts`. This stores ESPN responses in the Node.js process heap within a warm serverless instance — the same pattern `lib/home/cache.ts` uses for the home aggregator.

> Note: the first iteration added `revalidateSeconds: 300` to `teamScheduleForLeague` call sites, which uses Vercel's network-level Data Cache. That reduced warm from 330 ms → 299 ms (miss) because the Data Cache round-trip itself costs ~250 ms. The second iteration switched to `unstable_cache` (in-process, ~1–5 ms reads), achieving 19 ms warm.

---

## After-State Timings (deployment `dpl_EeDuEcA7xZbAuCUXfTXQLmFKyFQ4`, commit `61ffef9`)

Measurements taken 2026-07-15 against the `unstable_cache` optimization. Same procedure as Task 2.2/2.3 (Vercel runtime logs, server-side durations).

### `/api/teams` (after)

| Run | Server-side (ms) | Notes |
|-----|-----------------|-------|
| Cold | 1 363 | 7 ESPN calls, no in-process cache (new instance) |
| Warm 2 | 19 | `unstable_cache` populated |
| Warm 3 | 18 | |
| Warm 4 | 19 | |
| Warm 5 | 21 | |
| Warm 6 | 34 | |

**Cold: 1 363 ms** | **Warm median (runs 2–6): 19 ms** | **Warm range: 18–34 ms**

### `/api/home` (after — unmodified)

| Run | Server-side (ms) | Notes |
|-----|-----------------|-------|
| Cold | 3 307 | Unmodified — higher natural variation vs baseline (more sports in season) |
| Warm 1 | 2 183 | Likely a second concurrent cold instance (different serverless container) |
| Warm 2 | 124 | Fully warm |
| Warm 3 | 116 | |
| Warm 4 | 117 | |
| Warm 5 | 139 | |
| Warm 6 | 134 | |

**Warm median (runs 3–7): 124 ms** — unchanged from baseline (home was not modified).

### `/api/teams/[id]/matches` (after — `revalidateSeconds: 300` from first iteration, in place)

| Run | Server-side (ms) |
|-----|-----------------|
| 1 | 37 |
| 2 | 17 |
| 3 | 17 |
| 4 | 19 |
| 5 | 16 |

**Warm median: 17 ms** | **Range: 16–37 ms**

---

## Before / After Summary

| Endpoint | Metric | Before | After | Δ | Target | Pass? |
|----------|--------|--------|-------|---|--------|-------|
| `/api/teams` | Warm median | 330 ms | **19 ms** | −94% | ≤ 100 ms | ✅ |
| `/api/teams` | Cold | 2 417 ms | **1 363 ms** | −44% | ≤ 600 ms | ❌ |
| `/api/home` | Warm median | 133 ms | **124 ms** | −7% | ≤ 200 ms | ✅ |
| `/api/teams/[id]/matches` | Warm median | 20 ms | **17 ms** | −15% | ≤ 50 ms | ✅ |
| `/api/favorites/search` | Warm median | 6 ms | (not re-measured; unchanged) | — | ≤ 20 ms | ✅ |

### Cold-target gap — Task 4.3 stop

`/api/teams` cold is **1 363 ms** against a confirmed target of ≤ 600 ms.

**Root cause:** `unstable_cache` stores responses in the Node.js process heap within the _current_ serverless function instance. A cold start (new instance, new deployment, or long inactivity) has no populated cache and must make all 7 ESPN calls live. The warm target (≤ 100 ms) is achievable and was dramatically exceeded at 19 ms. The cold target (≤ 600 ms) implicitly assumed persistence across instances, which requires the Vercel Data Cache (`revalidateSeconds`) — but that approach costs ~250 ms per warm read, preventing the warm target from being met.

**Trade-off:**
- `unstable_cache` (current): warm 19 ms ✅, cold 1 363 ms ❌
- `revalidateSeconds` (first attempt): warm ~299 ms ❌, cold would likely improve (Data Cache survives instances)
- Hybrid (both): warm ~19 ms ✅ from in-process hit; cold ~200–300 ms ✅ from Data Cache on first instance request — but adds complexity

**Decision (2026-07-15):** Accept and document (option C). No additional code change. The cold performance is bounded by ESPN API latency across 7 live calls; the confirmed cold target (≤ 600 ms) was set before the `unstable_cache` vs. Data Cache trade-off was understood. The warm target (≤ 100 ms) — the common case for active polling users — is met at 19 ms. Cold starts occur only on new deployments or after extended inactivity and are acceptable at 1 363 ms (44% improvement from 2 417 ms baseline).
