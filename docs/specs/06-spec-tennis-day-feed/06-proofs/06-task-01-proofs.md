# Task 01 Proofs — Per-day tennis aggregation in the home envelope

## Task Summary

This task completes the half-finished `TennisByDay` refactor so the homepage data layer fetches active tennis tournaments for yesterday, today, and tomorrow (not just today), carries them on `HomeEnvelope` as a per-day structure, isolates per-day fetch failures, and type-checks cleanly across every producer and consumer.

## What This Task Proves

- `HomeEnvelope.activeTennisTournaments` is now a per-day structure `{ yesterday, today, tomorrow }`, defaulted in `EMPTY_ENVELOPE` and `buildHomeEnvelope`.
- `aggregateMatchesForUser` fetches tennis once per local day and assembles the per-day result.
- A single day's tennis fetch rejection yields `[]` for that day plus a `source.errors` entry, while the other two days still populate.
- Every consumer (home-client, route test, aggregator test) compiles against the new shape — `pnpm typecheck` is clean and the full suite passes.

## Evidence Summary

- `pnpm typecheck` exits 0 — the refactor is internally consistent.
- `lib/home/aggregator.test.ts` (20 tests) asserts per-day population and per-day rejection isolation.
- `app/api/home/route.test.ts` (6 tests) passes against the new envelope shape.
- Full suite: 308 tests pass; lint 0 errors; format clean.

## Artifact: TypeScript typecheck

**What it proves:** The `TennisByDay` migration is consistent across all producers and consumers — no consumer still references the old `ActiveTournament[]` shape.

**Why it matters:** The working tree was previously red (6 typecheck errors) from a partial refactor; a clean typecheck is the gate that the refactor is complete.

**Command:**

```bash
pnpm typecheck
```

**Result summary:** Exits 0 with no errors.

## Artifact: Aggregator + route tests

**What it proves:** Per-day aggregation and partial-failure isolation work, and the `/api/home` route contract still holds under the new shape.

**Why it matters:** These are the core data-layer behaviors the rest of the feature builds on.

**Command:**

```bash
pnpm vitest run lib/home/aggregator.test.ts app/api/home/route.test.ts
```

**Result summary:** 26 tests pass. New/updated cases assert each day carries its own tournament list, that a single rejected day is isolated (`[]` + one `source.errors` entry) while the others populate, and that `EMPTY_ENVELOPE` carries the per-day shape.

```
✓ app/api/home/route.test.ts (6 tests)
✓ lib/home/aggregator.test.ts (20 tests)
  ✓ populates activeTennisTournaments per day from the tennis fetcher
  ✓ isolates a single day's tennis fetch rejection: that day is [] + source.errors, other days still populate
  ✓ EMPTY_ENVELOPE includes activeTennisTournaments defaulting to the per-day shape
Test Files  2 passed (2)
Tests  26 passed (26)
```

## Artifact: Full gate run

**What it proves:** No regressions from the refactor.

**Result summary:** `pnpm test:ci` → 308 passed (33 files); `pnpm lint` → 0 errors (2 pre-existing warnings unrelated to this task); `pnpm format:check` → clean.

## Reviewer Conclusion

The homepage data layer now fetches and carries tennis per day with isolated failure handling, the build is green again, and the full suite passes — establishing the data foundation for per-day rendering (Task 3) and correct bucketing (Task 2).
