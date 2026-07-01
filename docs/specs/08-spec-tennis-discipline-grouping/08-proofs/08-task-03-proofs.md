# Task 03 Proofs — Grouped dropdown sections (top-5 / show-more / live pinning)

## Task Summary

This task restructures the expanded tournament card body into per-discipline/gender section dropdowns via a new `MatchGroupSection` client component. Each section is collapsed by default, shows the top 5 matches by priority, reveals 5 more per "Show more", and pins live matches first. The card header is unchanged; the card-level `defaultOpen` is retained (it reveals the sections).

## What This Task Proves

- Expanding a tournament card renders one collapsed dropdown per non-empty discipline/gender section, each with a label + match count.
- A section expands to at most 5 matches; "Show more (N)" reveals 5 more and disappears when exhausted; collapsing resets the visible count to 5.
- Live matches are pinned to the top of a section regardless of priority.
- Section toggles and "Show more" meet the 44px touch target (`min-h-11`).
- Empty disciplines are omitted; a tournament with no classifiable draws renders no section body.
- The existing header (name/date/round/counts) is unchanged, and nothing regresses.

## Evidence Summary

- `match-group-section.test.tsx` (8) + `tournament-card.test.tsx` (9) pass; full suite 360/360; typecheck, format, lint (0 errors), and `pnpm build` all pass.
- Live browser verification on `/dev-fixture/tennis-day`: the card renders a "Men's Singles · 2" section that expands to its match cards.

## Artifact: Component + card tests

**What it proves:** Every Unit 3 behavior — collapse default, ≤5 render, show-more, exhaustion, collapse-reset, live-first, touch targets, empty-section omission, empty body, header-unchanged.

**Command:**

```bash
pnpm test:ci components/match-group-section.test.tsx components/tournament-card.test.tsx
```

**Result summary:** 16 tests pass (7 section behaviors + a StrictMode toggle smoke test; 9 card cases).

```
✓ components/tournament-card.test.tsx (9 tests)
✓ components/match-group-section.test.tsx (8 tests)
 Test Files  2 passed (2)
      Tests  16 passed (16)
```

## Artifact: Live browser render (grouped sections)

**What it proves:** In the real app the card body is now a section dropdown, and it expands to the underlying match cards — end-to-end, not just in jsdom.

**Why it matters:** The whole point of the feature is the interactive grouped UI; this shows it working in a browser.

**Reproduce:** `pnpm dev`, open `/dev-fixture/tennis-day`, then in the console:

```js
document.querySelector('[data-testid="match-group"] button').click();
({
  expanded: document.querySelector('[data-testid="match-group"] button').getAttribute('aria-expanded'),
  cards: document.querySelectorAll('[data-testid="match-card"]').length,
});
```

**Result summary:** The Wimbledon card (unchanged header) renders a "Men's Singles · 2" section dropdown; after one click it reports `{ expanded: "true", cards: 2 }`. (Polished 32+32 screenshots with a live match are captured in Task 4.0 with the extended dev fixture.)

## Artifact: Verification note — browser caught a stale-bundle gotcha

**What it proves:** The shipped toggle works on a clean load.

**Why it matters:** During verification, the first clicks didn't register because the dev server was still serving a pre-edit bundle (HMR not yet applied). After a clean reload, a single click reliably expands the section (`aria-expanded: true`, 2 cards). The state updaters were also simplified to be pure (no nested `setState`).

```text
after reload + one click → { sectionExpanded: "true", matchCards: 2 }
```

## Artifact: Full gates + build

**Command:**

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:ci && pnpm build
```

**Result summary:** Typecheck clean; lint 0 errors (2 pre-existing warnings in an unrelated script); format clean; 360/360 tests; production build succeeds.

```
 Test Files  36 passed (36)
      Tests  360 passed (360)
```

## Reviewer Conclusion

The expanded tournament card now groups matches into collapsible discipline/gender dropdowns with top-5 truncation, incremental "Show more", and live pinning — verified by component tests and a live browser render, with the header preserved and the full suite green.
