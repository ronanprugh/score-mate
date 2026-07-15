# 12-code-quality-findings.md

Code-quality observations surfaced during Tasks 1.0–4.0 of Spec 12 (Performance Optimization). Ordered high → medium → low. Each finding includes a file reference, issue, why it matters, and a suggested direction.

---

## Scope Containment Verification

Spec 12 code changes are limited to:

- `lib/perf/server-timing.ts` + `lib/perf/server-timing.test.ts` (Task 1.0 — new instrumentation helper)
- `lib/home/aggregator.ts` (Task 1.0 — exported `planFanoutCount`)
- `app/api/home/route.ts` + tests (Task 1.0 — instrumentation)
- `app/api/teams/route.ts` + tests (Task 1.0 instrumentation + Task 3.0 `unstable_cache`)
- `app/api/teams/[favoriteId]/matches/route.ts` + tests (Task 1.0 + first-iteration `revalidateSeconds`)
- `app/api/favorites/search/route.ts` + tests (Task 1.0 — instrumentation)
- `docs/specs/12-spec-performance-optimization/` (proof artifacts, baseline, findings)

No refactoring, no schema changes, no unrelated code touched. `git log --oneline` for this spec:

```
885e88e docs(perf): record before/after performance evidence
61ffef9 perf(teams): wrap entity ESPN calls in unstable_cache for in-process caching
3b628f45 perf(teams): add revalidateSeconds:300 to teamScheduleForLeague call sites
6598c27 chore: mark task 2.0 in progress
(baseline measurement commits)
(T1.0 instrumentation commits)
```

---

## HIGH Priority

### H-1: `lib/espn/client.ts` is a 940-line monolith

**File:** [`lib/espn/client.ts`](../../lib/espn/client.ts)

**Issue:** A single 940-line file mixes four distinct concerns:

1. URL builders (`buildScoreboardUrl`, `buildLeagueTeamsUrl`, `buildTeamScheduleUrl`)
2. Parsers (`parseEvent`, `parseTeam`, `parseLeagueFromScoreboard`, `parseAthleteCompetition`)
3. Data-fetching functions (`scoreboardForLeague`, `teamScheduleForLeague`, `athleteSchedule`, `athleteMatchHistory`, `searchAthletes`, `fetchEventCoreDetail`)
4. Shared types and constants

**Why it matters:** The file is the most-edited file in the repo (every new sport or ESPN endpoint requires touching it). Its size makes it hard to navigate, and function-level changes (e.g., adding a new sport's URL scheme) risk unrelated regressions. It also makes it harder to mock just URL-building logic in tests without pulling in the entire fetch client.

**Suggested direction:** Split into purpose-oriented modules under `lib/espn/`:

- `urls.ts` — pure URL builders (zero runtime deps, trivially testable)
- `parsers.ts` — pure data transformers
- `client.ts` — fetch utilities + `fetchJson` (20–30 lines)
- `scoreboard.ts`, `teams.ts`, `athletes.ts` — domain functions composing the above

No behavior change; existing imports can be kept stable via a re-export barrel if needed.

---

## MEDIUM Priority

### M-1: `addDays` duplicated in two sibling files

**Files:** [`lib/home/cache.ts:44`](../../lib/home/cache.ts#L44), [`lib/home/aggregator.ts:95`](../../lib/home/aggregator.ts#L95)

**Issue:** Identical `addDays(yyyyMmDd, delta)` implementations appear in both files:

```ts
function addDays(yyyyMmDd: string, delta: number): string {
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
```

**Why it matters:** Two copies mean two places to fix if the date arithmetic ever needs to change (e.g., DST edge case, locale handling). One is already tested implicitly through aggregator tests; the other is not independently tested.

**Suggested direction:** Extract to `lib/home/date-utils.ts` (or `lib/utils/date.ts` if other modules need it), export, and import from both call sites. Trivial change, no behavior impact.

---

### M-2: Teams route uses inline `unstable_cache` instead of a caching layer

**File:** [`app/api/teams/route.ts:96,137`](../../app/api/teams/route.ts#L96)

**Issue:** The `buildEntity` function calls `unstable_cache(...)()` inline in application logic. This is inconsistent with how the home route handles caching — `lib/home/cache.ts` owns all caching wrappers and exposes clean typed functions (`cachedScoreboard`, `cachedTennisTournaments`). The teams route embeds caching detail inside a business-logic function.

**Why it matters:** The `unstable_cache` call signature (key array, options object) is boilerplate that should live in a caching layer, not in route code. It also makes the `unstable_cache` mock in `route.test.ts` necessary — if caching were in `lib/teams/cache.ts`, the mock would belong there and the route test would not need to know about Next.js cache internals.

**Suggested direction:** Extract a `lib/teams/cache.ts` module with `cachedAthleteSchedule(leagueKey, athleteId)` and `cachedTeamSchedule(leagueKey, teamId)`, mirroring the `lib/home/cache.ts` pattern. The route imports the cached functions directly. Move the `vi.mock("next/cache", ...)` to a `lib/teams/cache.test.ts`.

---

### M-3: Inconsistent caching strategies between teams endpoints

**Files:** [`app/api/teams/route.ts`](../../app/api/teams/route.ts) (uses `unstable_cache`), [`app/api/teams/[favoriteId]/matches/route.ts:80`](../../app/api/teams/[favoriteId]/matches/route.ts#L80) (uses `revalidateSeconds` / Vercel Data Cache)

**Issue:** The two teams endpoints use different caching mechanisms with different performance characteristics. The entity-card route (`/api/teams`) uses `unstable_cache` (in-process, ~5 ms warm reads). The match-history route (`/api/teams/[id]/matches`) uses `revalidateSeconds: 300` (Vercel Data Cache, ~200–250 ms warm reads). The match-history endpoint was already fast at baseline (17–22 ms warm) so the inconsistency was not a bottleneck, but the architectural split is surprising.

**Why it matters:** A future developer maintaining these two files will see different patterns and may not understand why. The match-history route's `revalidateSeconds` was added in the first optimization iteration (T3.0, attempt 1) and not revisited when `unstable_cache` was adopted. It should either be harmonized or the difference should be documented where it matters.

**Suggested direction:** If M-2 (extract `lib/teams/cache.ts`) is addressed, both endpoints can import from the same caching layer and use `unstable_cache` consistently. If that refactor is deferred, add a comment at the `revalidateSeconds` call site explaining the intentional difference.

---

## LOW Priority

### L-1: `unstable_cache` is deprecated in Next.js 16 — Cache Components migration

**Files:** [`lib/home/cache.ts`](../../lib/home/cache.ts) (2 call sites), [`app/api/teams/route.ts`](../../app/api/teams/route.ts) (2 call sites)

**Issue:** `unstable_cache` is the Next.js 14–15 caching API. Next.js 16 replaces it with the `"use cache"` directive (Cache Components), enabled via `cacheComponents: true` in `next.config.ts`. The `unstable_cache` function is still available in 16.x but is no longer the idiomatic approach. See [Cache Components Migration guide](../../node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md).

**Why it matters (in context):** `unstable_cache` continues to work, so this is not urgent. The risk is drift: as Next.js evolves, `unstable_cache` may be removed or further deprecated, and the Cache Components APIs (`cacheTag`, `cacheLife`, `revalidateTag`) offer features (tagged invalidation, granular TTL profiles, remote cache handlers) that `unstable_cache` cannot provide.

See the dedicated evaluation section below.

---

### L-2: Per-request `auth()` database round-trip on every API call

**Files:** `app/api/home/route.ts:68`, `app/api/teams/route.ts:158`, `app/api/favorites/search/route.ts:62`

**Issue:** Auth.js with the database session strategy (`sessionStrategy: "database"`) requires a DB lookup per `auth()` call. This adds one Neon Postgres RTT to every API response. At baseline warm timings, this cost was approximately 10–20 ms (consistent with the favorites/search baseline: first call 44 ms, warm 6 ms — the first call includes session lookup; subsequent calls in the same instance may benefit from connection reuse).

**Why it matters:** For a low-traffic personal app, this is acceptable. If traffic grows or the DB connection pool tightens (e.g., Neon's serverless cold-connection overhead), session lookup becomes a bottleneck.

**Suggested direction:** Consider JWT sessions (configured in Auth.js `session: { strategy: "jwt" }`) if the app does not require server-side session revocation. JWT sessions eliminate the per-request DB lookup at the cost of a signing/verification CPU step (~0.5 ms) and losing the ability to invalidate sessions server-side without a denylist.

---

## Cache Components Migration Evaluation

### What a migration would entail

Cache Components is enabled by adding `cacheComponents: true` to `next.config.ts`. This single flag simultaneously enables:

- The `"use cache"` directive (replaces `unstable_cache`)
- The `cacheLife` / `cacheTag` / `revalidateTag` APIs
- **Partial Prerendering (PPR)** as the default App Router rendering mode

The `"use cache"` directive is placed at file, component, or function level:

```ts
// Before (current)
import { unstable_cache } from "next/cache";
const cached = unstable_cache(
  async () => fetchData(key),
  ["prefix", key],
  { revalidate: 300 },
);

// After (Cache Components)
async function fetchData(key: string) {
  "use cache";
  cacheLife({ revalidate: 300 });
  return fetchFromEspn(key);
}
```

Cache keys are auto-derived from the function identity and serialized arguments — no manual key array required.

**Files to migrate:**

| File | Current API | Migration |
|------|-------------|-----------|
| `lib/home/cache.ts` | `unstable_cache` ×2 | Add `'use cache'` + `cacheLife` to `scoreboardForLeague` and `getActiveTennisTournaments` wrappers |
| `app/api/teams/route.ts` | `unstable_cache` ×2 | Extract to `lib/teams/cache.ts` (per M-2) and add `'use cache'` |

### Serverless behavior note

In a serverless environment (Vercel), `'use cache'` stores entries in in-memory LRU per instance by default — the **same per-instance limitation as `unstable_cache`**. Cross-instance persistence (which would help cold starts) requires `'use cache: remote'` with a dedicated cache handler (Redis, Vercel KV) — this adds a network round-trip similar to `revalidateSeconds`/Data Cache and comes with platform costs.

### Recommendation

**Defer migration; plan as a separate spec.** Reasons:

1. `unstable_cache` continues to function correctly in Next.js 16. No breaking behavior.
2. Enabling `cacheComponents` also enables PPR, which changes rendering semantics for all pages and requires verification of the streaming/static-shell behavior in the authenticated home and teams pages. This is non-trivial to test in a sandboxed environment.
3. The migration itself is mechanical (~2–3 hours of changes) but the PPR behavior audit could take significantly longer (estimated 1–2 days).
4. The `'use cache'` directive does not solve the cold-start limitation — that would require the additional `'use cache: remote'` + a KV store, which is a larger architectural decision.

**When to prioritize:** When a future spec adds on-demand cache invalidation (e.g., "refresh scores now" button), `cacheTag` + `revalidateTag` become compelling. At that point, migrating away from `unstable_cache` (which has no tag support) is the right trigger.

**Rough scope estimate (migration only, excluding PPR verification):**

- `next.config.ts`: 1 line
- `lib/home/cache.ts`: ~30 lines changed (remove wrapper functions, add directive + `cacheLife` to the underlying ESPN fetch functions)
- `lib/teams/cache.ts` (new, per M-2): ~30 lines
- Test mocks: update `vi.mock("next/cache", ...)` in affected test files
- **Total code change**: ~1 hour
- **PPR behavior verification on all page routes**: 1–2 days

---

## Summary Table

| Priority | ID | Finding | File(s) | Effort |
|----------|----|---------|---------|--------|
| HIGH | H-1 | `client.ts` 940-line monolith | `lib/espn/client.ts` | Medium (split into 4–5 modules, no behavior change) |
| MEDIUM | M-1 | `addDays` duplicated | `lib/home/cache.ts`, `lib/home/aggregator.ts` | Trivial (extract, import) |
| MEDIUM | M-2 | Inline `unstable_cache` in route logic | `app/api/teams/route.ts` | Small (extract `lib/teams/cache.ts`) |
| MEDIUM | M-3 | Inconsistent caching strategy between teams endpoints | teams route vs matches route | Trivial if M-2 done; comment otherwise |
| LOW | L-1 | `unstable_cache` deprecated; Cache Components migration | `lib/home/cache.ts`, `app/api/teams/route.ts` | Small code / large PPR verification |
| LOW | L-2 | Per-request DB session lookup | all 3 API routes | Medium (JWT session migration) |
