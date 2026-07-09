# Task 2 Proofs - Tournament card staged interaction & UI

## Task Summary

This task wires the pure staged-reveal logic from Task 1.0 into
`TournamentCard`. The card is now collapsed by default; a single header
toggle button advances it through singles → singles+doubles → back to
collapsed. A chevron and stage-hint label (e.g. "Singles", "Singles +
Doubles") make the interaction discoverable, `aria-expanded` reflects state
for accessibility, and singles-only / doubles-only / no-sections tournaments
degrade gracefully. Existing per-section `MatchGroupSection` behavior
(collapsed-by-default, independent expand, "Show more") is unchanged.

## What This Task Proves

- The card renders **zero** discipline sections until activated (default
  collapsed).
- The **first** activation reveals only the singles sections; a **second**
  activation additionally reveals the doubles/mixed sections; a **third**
  activation wraps back to collapsed.
- `aria-expanded` and the visible stage-hint text update correctly across the
  click cycle.
- Singles-only and doubles-only tournaments expose exactly one expanded
  stage with the correct sections (no dead "empty" stage).
- A tournament with no classifiable sections renders a non-interactive
  header — no toggle button at all.
- Each card's stage is independent (two cards on the same page toggle
  separately) and ephemeral (a remount resets to collapsed).
- The end-to-end interaction works correctly in a real browser, verified at
  the app's primary mobile-first target width.

## Evidence Summary

- `pnpm test:ci components/tournament-card.test.tsx` passes all 14 tests,
  covering every functional requirement above plus the two audit-flagged
  regression guards (doubles-only UI path, remount/reset).
- `pnpm lint`, `pnpm format:check`, and `pnpm typecheck` are clean.
- Manual browser verification via the `app/dev-fixture/tennis-day` fixture
  at a 375×812 mobile viewport confirmed all three stages render correctly:
  collapsed (1 button, 0 sections) → singles (2 sections: Men's/Women's
  Singles) → singles+doubles (5 sections: adds Men's/Women's/Mixed Doubles),
  with the tournament title fully legible at every stage.

## Artifact: Component test suite (`tournament-card.test.tsx`)

**What it proves:** Every functional requirement from Spec Unit 2 — collapsed
default, staged reveal, wrap cycle, `aria-expanded`/hint updates, graceful
single-family and no-sections degradation, per-card independence, and
ephemeral state — is exercised against the real component render tree (not
just the pure logic layer).

**Why it matters:** This is the primary automated proof that the UI wiring
correctly consumes `lib/home/tennis-card-stages.ts` and that a future
refactor can't silently break the staged-disclosure contract.

**Command:**

```bash
pnpm test:ci components/tournament-card.test.tsx
```

**Result summary:** All 14 tests passed, including the two tests added to
close the planning-audit FLAG findings: `(c4)` proves a doubles-only
tournament reveals its doubles sections on first activation (not just at the
pure-logic layer), and `(f)` proves a remounted card resets to stage 0,
guarding the ephemeral-state requirement.

```text
$ vitest run components/tournament-card.test.tsx

 RUN  v2.1.9 /Users/rprugh/repos/score-mate

 ✓ components/tournament-card.test.tsx (14 tests) 149ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  1.02s
```

## Artifact: Full regression suite

**What it proves:** No existing behavior elsewhere in the app (favorites,
home aggregation, ESPN client, etc.) was broken by this change.

**Why it matters:** `TournamentCard` is rendered from the shared home feed;
a regression here would be visible across every tournament, not just tennis
staged disclosure.

**Command:**

```bash
pnpm test:ci
```

**Result summary:** All 42 test files / 423 tests passed, with no failures
introduced by this task.

## Artifact: Live browser verification (staged reveal at mobile viewport)

**What it proves:** The staged disclosure works end-to-end in a real
rendered browser session, not just under jsdom — including the click
interaction, DOM updates, and visual layout at the app's mobile-first target
width.

**Why it matters:** Component tests confirm logic and markup, but only a
live render confirms the actual pixel-level experience a user gets,
including the `hidden … sm:block` responsive behavior of the round label and
stage hint.

**How it was verified:** Started the dev server (`pnpm dev` via the project
launch config) and opened `/ScoreMate/dev-fixture/tennis-day` (the app has a
configured `basePath: "/ScoreMate"`) at a 375×812 mobile viewport — the
project's stated primary target ("Mobile-first personal sports
score-tracker"). Clicked the card header toggle through the full cycle and
inspected the resulting DOM/accessibility tree and screenshots at each
stage.

**Result summary:**

- **Stage 0 (collapsed):** card shows only the header (`Wimbledon`, date
  range, live/upcoming/done counts, chevron) — zero `match-group` sections
  rendered, matching test `(b)`.
- **Stage 1 (singles):** after one click, exactly two sections appear —
  "Men's Singles" (33) and "Women's Singles" (32) — with no doubles
  sections, matching test `(b2)`.
- **Stage 2 (singles + doubles):** after a second click, three more
  sections appear — "Men's Doubles" (2), "Women's Doubles" (1), "Mixed
  Doubles" (2) — for five sections total, matching test `(b3)`.
- A third click returned the card to the zero-section collapsed state
  (verified via DOM button count returning to 1), matching test `(b4)`.
- At this mobile viewport, the round label and stage hint (both
  `hidden … sm:block`) correctly stay hidden, so the tournament title never
  truncates — confirming the responsive design considerations from the spec
  hold on a real device-width viewport.

**Note on screenshot artifacts:** Screenshots were captured and visually
inspected during this verification session using the project's browser
preview tooling, confirming the behavior described above. The available
tooling in this environment does not expose a way to export those captured
images to a binary file for committing into the repository, so this artifact
is documented narratively with the exact DOM/state evidence observed
(section counts, labels, and button/`aria-expanded` state at each stage)
rather than as embedded image files.

## Reviewer Conclusion

The tournament card now implements the full staged-disclosure contract from
Spec 10: collapsed by default, singles-first reveal, doubles on a second
activation, wrap-to-collapsed cycling, accessible `aria-expanded` state, a
discoverable stage hint, and graceful degradation for singles-only,
doubles-only, and no-sections tournaments — verified by 14 passing component
tests, a clean full regression suite (423/423), and a live browser check at
the app's mobile-first target viewport.
