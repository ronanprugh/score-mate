# Task 02 Proofs — Active-tournament aggregator + cache layer + cache prefix bump

## Task Summary

This task builds the runtime data pipeline for Tennis on the homepage. `getActiveTennisTournaments(today, fetcher)` fans out to all 23 marquee scoreboards and returns only tournaments with at least one match today, enriched with live/upcoming/done counts. It is wrapped in a 1-hour `unstable_cache` layer with the bumped prefix `v7-espn-tennis`, and the result flows through `HomeEnvelope.activeTennisTournaments` to the homepage.

## What This Task Proves

- Only tournaments returning ≥1 match for `today` appear in the aggregator output.
- `liveCount`, `upcomingCount`, `doneCount` are computed correctly from match statuses.
- `currentRound` is derived from the first match's round field.
- `CACHE_KEY_PREFIX` is `"v7-espn-tennis"` (invalidates prior keyspace on deploy).
- The `cachedActiveTennisTournaments` cache key shape includes the prefix, `"tennis-active"`, and the date.
- `HomeEnvelope` has an `activeTennisTournaments: ActiveTournament[]` field populated by the aggregator.
- On fetcher rejection, the envelope still returns with `activeTennisTournaments: []` and a `source.errors` entry.

## Evidence Summary

- `lib/home/tennis-aggregator.test.ts`: 5 tests cover filtering, counts, and round parsing.
- `lib/home/cache.test.ts`: asserts `CACHE_KEY_PREFIX === "v7-espn-tennis"` and correct tennis cache key shape.
- `lib/home/aggregator.test.ts`: 3 new tests cover `activeTennisTournaments` field on the envelope, rejection fallback, and `EMPTY_ENVELOPE` default.
- `pnpm typecheck` exits 0.
- `pnpm test:ci`: 296 tests pass.

## Artifact: tennis-aggregator.test.ts

**What it proves:** Only non-empty tournaments surface; counts and currentRound are derived correctly.

**Why it matters:** The aggregator is the single filter gate between raw ESPN data and the homepage feed. Wrong filtering means phantom or missing tournament cards.

**Result summary:**

```
lib/home/tennis-aggregator.test.ts — 5 tests passed  ✓
```

Tests include:
- Fixture of 5 tournaments (3 with matches, 2 empty) → only 3 in output
- `liveCount`/`upcomingCount`/`doneCount` match the fixture's status distribution
- `currentRound` parsed from first match's `round` field

## Artifact: cache.test.ts — prefix + key shape

**What it proves:** The cache prefix was bumped and the tennis cache key follows the expected shape.

**Why it matters:** SM §3 states this prefix bump is the deploy invalidation mechanism; a wrong prefix would mean stale pre-tennis data is served after deploy.

**Result summary:**

```
lib/home/cache.test.ts — 9 tests passed  ✓
```

Including:
- `CACHE_KEY_PREFIX === "v7-espn-tennis"` ✓
- Cache key for `cachedActiveTennisTournaments("2026-06-25")` includes `["v7-espn-tennis", "tennis-active", "2026-06-25"]` ✓

## Artifact: aggregator.test.ts — HomeEnvelope tennis field

**What it proves:** `aggregateMatchesForUser` populates `activeTennisTournaments` and handles rejection gracefully.

**Why it matters:** If the field were missing from the envelope, the homepage would render no tournament cards even when tennis is active.

**Result summary:**

```
lib/home/aggregator.test.ts — 20 tests passed  ✓ (previously 17, +3 new)
```

New tests:
- `aggregateMatchesForUser > populates activeTennisTournaments from the tennis fetcher` ✓
- `aggregateMatchesForUser > on tennis fetcher rejection: envelope succeeds with activeTennisTournaments=[] and a source.errors entry` ✓
- `aggregateMatchesForUser > EMPTY_ENVELOPE includes activeTennisTournaments field defaulting to []` ✓

## Artifact: TypeScript typecheck

**What it proves:** `ActiveTournament` and the new `Fetchers` / `HomeEnvelope` fields are type-safe with no `any`.

**Command:**

```bash
pnpm typecheck
```

**Result summary:** Exits 0 with no errors.

## Reviewer Conclusion

The Tennis aggregator correctly filters, counts, and threads tournament data through the cache and envelope layers. SM §3 cache invalidation is verified by the `CACHE_KEY_PREFIX` assertion. The rejection-safety fallback ensures the homepage never breaks when the Tennis ESPN endpoints are unreachable.
