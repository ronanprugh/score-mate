# Task 02 Proofs — Local-day bucketing + accurate tournament metadata

## Task Summary

This task makes `tennisScoreboard` timezone-aware so competitions are bucketed by the user's *local* date (matching how team-sport matches are bucketed) instead of a raw UTC comparison. It also surfaces each tournament's overall draw span and derives the card's "current round" from the real round (`tennis.round`) rather than the draw name — while preserving Spec 05's ATP/WTA dedupe and whole-draw safeguards.

## What This Task Proves

- A competition whose UTC date differs from the user's local date is bucketed to the correct **local** day (fixes the off-by-one that hid/misplaced late-evening matches).
- The fix holds across both a DST-observing zone (`America/New_York`) and a date-line zone (`Pacific/Auckland`).
- `tennisScoreboard` returns the tournament's overall draw span, so the card shows the full run (e.g. "Aug 25 – Sep 7") instead of a single day.
- `ActiveTournament.currentRound` prefers the real round ("Quarterfinals") over the draw/grouping name ("Men's Singles").
- `tz` is part of the tennis cache key, so two timezones never share a differently-bucketed cache entry.
- Spec 05 dedupe + date-filter behavior still passes; the team-sport path is untouched.

## Evidence Summary

- `lib/espn/tennis.test.ts` (20 tests) adds local-date bucketing (NY + Auckland) and event-span cases; dedupe/whole-draw cases still green.
- `lib/home/tennis-aggregator.test.ts` (6 tests) asserts date range = draw span and `currentRound` = real round.
- `lib/home/cache.test.ts` (10 tests) asserts the cache key includes `tz` and that two timezones yield distinct keys.
- Full suite: 313 tests pass; typecheck clean; lint 0 errors; format clean.

## Artifact: Local-day bucketing (timezone-aware)

**What it proves:** `tennisScoreboard` filters competitions by local date in `opts.tz`, not by raw UTC.

**Why it matters:** This is the off-by-one bug — under the old UTC comparison a 01:30 UTC match (still "last night" locally) landed on the wrong day tab or vanished.

**Command:**

```bash
pnpm vitest run lib/espn/tennis.test.ts
```

**Result summary:** A 2026-07-02T01:30Z competition is bucketed to Jul 1 under `America/New_York`, excluded from Jul 2 (NY), and bucketed to Jul 2 under UTC. A separate date-line case (`Pacific/Auckland`, +12) confirms forward rollover. All pass.

```
✓ buckets competitions by local date (tz), not raw UTC
✓ buckets correctly across the date line (Pacific/Auckland, +12)
✓ returns the tournament's overall draw span across all rounds
✓ dedupes matches when atp + wta responses overlap on the same competition id
✓ filters competitions to the requested date (ESPN returns the whole draw)
```

## Artifact: Accurate tournament metadata

**What it proves:** Date range comes from the overall draw span, and current round comes from the real round.

**Why it matters:** With per-day filtering the old min/max-of-today logic collapsed the date range to one day, and the round previously showed the draw name ("Men's Singles") instead of "Quarterfinals".

**Command:**

```bash
pnpm vitest run lib/home/tennis-aggregator.test.ts
```

**Result summary:**

```
✓ prefers the real round (tennis.round) over the draw name for currentRound
✓ uses the tournament's overall draw span for startDate/endDate, not the day's matches
✓ falls back to the day's match dates when no draw span is provided
```

## Artifact: Timezone-keyed cache

**What it proves:** The tennis cache key includes `tz`, and two timezones for the same date produce distinct keys.

**Why it matters:** Bucketing now depends on `tz`; without `tz` in the key, a New York user could be served a cache entry bucketed for Auckland.

**Command:**

```bash
pnpm vitest run lib/home/cache.test.ts
```

**Result summary:**

```
✓ tennisActiveCacheKey includes prefix, 'tennis-active', date, and tz
✓ tennisActiveCacheKey: different timezones produce distinct keys for the same date
```

## Artifact: Full gate run

**What it proves:** No regressions; the team-sport path is unchanged.

**Result summary:** `pnpm test:ci` → 313 passed (33 files); `pnpm typecheck` → 0 errors; `pnpm lint` → 0 errors (2 pre-existing warnings); `pnpm format:check` → clean.

## Reviewer Conclusion

Tennis matches now bucket by the user's local day (verified across DST and date-line zones), the tournament card has accurate date-range and round metadata sourced from the whole draw, and the cache is correctly keyed by timezone — all without touching the team-sport feed.
