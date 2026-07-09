# Task 1 Proofs - Pure staged-reveal logic (stages, cumulative sections, hint)

## Task Summary

This task builds the pure, framework-free logic that decides which discipline
sections a tournament card should show at each "stage" of disclosure — from
collapsed, to singles only, to singles + doubles — and how the stage advances
and wraps back to collapsed. It lives in `lib/home/tennis-card-stages.ts` and
is entirely independent of React, so it can be exhaustively tested without
rendering anything. `components/tournament-card.tsx` (Task 2.0) will consume
this module directly.

## What This Task Proves

- Tournament sections are correctly partitioned into a **singles family**
  (`mens-singles`, `womens-singles`) and a **doubles family**
  (`mens-doubles`, `womens-doubles`, `mixed-doubles`), and only families that
  actually have matches produce a reveal stage — no dead "empty doubles"
  clicks.
- The cumulative stage → visible-sections mapping is correct: stage 1 shows
  singles only, stage 2 additionally shows doubles, always in canonical
  `SECTION_ORDER`.
- Advancing past the final stage wraps back to stage 0 (collapsed), giving a
  single toggle a clean forward-then-reset cycle.
- Singles-only and doubles-only tournaments degrade gracefully to a single
  expanded stage instead of exposing a stage with nothing in it.
- The stage hint label (`"Singles"`, `"Singles + Doubles"`, `"Doubles"`) is
  derived from which families are actually visible, not hardcoded per
  tournament shape.

## Evidence Summary

- `pnpm test:ci lib/home/tennis-card-stages.test.ts` passes all 18 tests
  covering `revealFamilies`, `totalStages`, `sectionsForStage`, `nextStage`,
  and `stageHint` across four tournament shapes (both-families, singles-only,
  doubles-only, no-sections).
- `pnpm lint`, `pnpm format:check`, and `pnpm typecheck` are all clean for the
  new module and its test file.

## Artifact: Stage logic test suite (`tennis-card-stages.test.ts`)

**What it proves:** Every functional requirement for Spec Unit 1 — family
classification, stage count, cumulative reveal, wrap-to-collapsed, and hint
text — is exercised for both-families, singles-only, doubles-only, and
no-sections tournaments.

**Why it matters:** This is the deterministic core the UI (Task 2.0) renders
directly from; correctness here means the card's behavior is correct for
every tournament shape without needing to re-derive the logic in component
tests.

**Command:**

```bash
pnpm test:ci lib/home/tennis-card-stages.test.ts
```

**Result summary:** All 18 tests passed in ~3ms test-execution time,
confirming: `revealFamilies` returns families in fixed order and omits absent
ones; `totalStages` is 3 for both-families, 2 for singles-only/doubles-only,
and 1 for no-sections; `sectionsForStage` returns only singles keys at stage
1 and singles+doubles at stage 2 (doubles withheld until stage 2, per spec);
`nextStage` cycles `0 → 1 → 2 → 0` for both-families and `0 → 1 → 0` for a
single-family tournament; `stageHint` returns `""`, `"Singles"`, and
`"Singles + Doubles"` at the corresponding stages, and `"Doubles"` for a
doubles-only tournament's single stage.

```text
$ vitest run lib/home/tennis-card-stages.test.ts

 RUN  v2.1.9 /Users/rprugh/repos/score-mate

 ✓ lib/home/tennis-card-stages.test.ts (18 tests) 3ms

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Duration  808ms
```

## Artifact: Quality gates (lint, format, typecheck)

**What it proves:** The new module and its test file conform to the repo's
TypeScript-strict and formatting/linting standards with zero errors.

**Why it matters:** Confirms the change is mergeable as-is and introduces no
new lint/type debt.

**Command:**

```bash
pnpm lint && pnpm format:check && pnpm typecheck
```

**Result summary:** `pnpm lint` reports 0 errors (2 pre-existing warnings in
unrelated files, not touched by this task); `pnpm format:check` reports all
files match Prettier style; `pnpm typecheck` (`tsc --noEmit`) completes with
no errors.

## Reviewer Conclusion

The pure staged-reveal logic in `lib/home/tennis-card-stages.ts` correctly
implements every rule from Spec Unit 1 — family partitioning, cumulative
stage reveal, wrap-to-collapsed cycling, graceful single-family degradation,
and stage-hint text — and is fully covered by 18 passing unit tests with
clean lint/format/typecheck. It is ready to be wired into `TournamentCard` in
Task 2.0.
