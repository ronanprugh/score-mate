# Task 02 Proofs — Match priority + discipline/gender grouping (pure logic)

## Task Summary

This task adds `lib/home/tennis-priority.ts`: pure, dependency-free helpers that classify a tennis match into one of five discipline/gender sections, compute each match's ranking-weighted priority score, and order/group a tournament's matches for the UI. No React or I/O.

## What This Task Proves

- The priority formula `(bestRank*2 + adjustedSecond)/3` is implemented with the top-100 cap exactly as specified, verified against every worked example.
- The doubles/mixed "average of partners' seeds" rule is implemented and tested (seeds 5 & 200 → 102.5).
- Draw classification maps to all five sections, is case-insensitive, avoids the "women" contains "men" trap, and excludes juniors/wheelchair/qualifying/unknown draws.
- Grouping returns non-empty sections in fixed order, drops unclassifiable matches, and sorts each section by priority → kickoff → id.

## Evidence Summary

- `tennis-priority.test.ts`: 23 tests pass, covering the formula, cap, doubles average, classification, exclusion, tie-breaking, and grouping.
- Full suite green: 350/350 tests. Typecheck clean, format clean, lint 0 errors.

## Artifact: Priority + grouping unit tests

**What it proves:** Every functional requirement of Unit 2 behaves as specified, including the exact worked example values.

**Why it matters:** These pure functions are the single source of truth for which matches surface first and how they're grouped — the UI (Task 3) is a thin consumer.

**Command:**

```bash
pnpm test:ci lib/home/tennis-priority.test.ts
```

**Result summary:** All 23 tests pass. Worked examples verified: `(1,3)→5/3`, `(1,150)→34`, `(50,unranked)→200/3`, `(120,150)→130`, both-unranked→9999, doubles `[5,200]→102.5`.

```
✓ lib/home/tennis-priority.test.ts (23 tests) 3ms
 Test Files  1 passed (1)
      Tests  23 passed (23)
```

## Artifact: Formula excerpt

**What it proves:** The cap is applied to the weaker side only when the stronger side is inside the top 100 — matching the request's clarified rule.

**Why it matters:** This is the subtle part of the spec; showing the code makes the rule auditable.

**Artifact path:** `lib/home/tennis-priority.ts`

```ts
export function priorityOf(rankA: number, rankB: number): number {
  const best = Math.min(rankA, rankB);
  const other = Math.max(rankA, rankB);
  const adjustedSecond = best <= 100 ? Math.min(100, other) : other;
  return (best * 2 + adjustedSecond) / 3;
}
```

**Result summary:** Direct translation of the spec formula; symmetric in its arguments (tested).

## Artifact: Full suite + gates

**What it proves:** The new module integrates without regressing anything.

**Command:**

```bash
pnpm typecheck && pnpm test:ci && pnpm format:check
```

**Result summary:** Typecheck clean; 350/350 tests pass; formatting clean; `pnpm lint` 0 errors (2 pre-existing warnings in an unrelated script).

```
 Test Files  36 passed (36)
      Tests  350 passed (350)
```

## Reviewer Conclusion

The priority and grouping logic is fully specified by tests, including every worked example and the tricky top-100 cap and "women/men" classification traps. It is pure and side-effect-free, ready for the UI to consume in Task 3.0.

> Note: the doubles-average rule is implemented as a pure helper and unit-tested; with ESPN's current data each doubles side carries a single team seed, so in practice a doubles side reduces to that seed. `averageSeed` keeps the spec's rule correct if per-partner seeds become available later.
