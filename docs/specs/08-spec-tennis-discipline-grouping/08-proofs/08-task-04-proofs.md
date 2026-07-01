# Task 04 Proofs — Dev fixture, end-to-end verification, and full quality gates

## Task Summary

This task extends the dev-only fixture at `/dev-fixture/tennis-day` to a realistic 32 + 32 singles draw (with seeds), plus doubles/mixed sections and a live match, then verifies the whole feature end-to-end in a browser and runs the complete CI gate set as the closing regression.

## What This Task Proves

- A tournament with 69 matches renders as five collapsed discipline/gender dropdowns (Men's/Women's Singles, Men's/Women's/Mixed Doubles) with correct counts.
- Expanding Men's Singles shows the top 5 by priority with the marquee seed-vs-seed matches first, and a live match pinned above them regardless of its (low) priority.
- "Show more" reveals 5 more per click and updates its remaining count.
- All CI gates pass: lint (0 errors), format, typecheck, 360 tests, and a production build.

## Evidence Summary

- Browser verification on `/dev-fixture/tennis-day` (programmatic, reproducible): five sections with counts `33 / 32 / 2 / 1 / 2`; Men's Singles expands to 5 cards, live first, `Show more (28)`; one "Show more" click → 10 cards, `Show more (23)`.
- `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci` (360), `pnpm build` all pass.

## Artifact: Section structure + counts

**What it proves:** The card groups a large draw into the five sections with correct per-section counts, collapsed by default.

**Reproduce:** `pnpm dev`, open `/dev-fixture/tennis-day`, then in the console:

```js
[...document.querySelectorAll('[data-testid="match-group"] button')].map((b) => b.textContent.trim());
```

**Result summary:** Five sections in fixed order with counts. Men's Singles is 33 (32-match draw + the live match); the tournament counts line reads `1 live · 69 upcoming · 0 done`.

```json
["Men's Singles33", "Women's Singles32", "Men's Doubles2", "Women's Doubles1", "Mixed Doubles2"]
```

## Artifact: Top-5, priority order, and live pinning

**What it proves:** An expanded section shows exactly 5 matches, ordered by priority, with any live match pinned first.

**Reproduce:** expand Men's Singles, then:

```js
const men = document.querySelector('[data-testid="match-group"]:first-child');
({
  cards: men.querySelectorAll('[data-testid="match-card"]').length,
  first: men.querySelector('[data-testid="match-card"]').getAttribute("aria-label"),
  showMore: [...men.querySelectorAll("button")].map((b) => b.textContent.trim()).find((t) => /Show more/.test(t)),
});
```

**Result summary:** 5 cards; the live "Live Underdog vs Wildcard Entrant" match renders first (red "Set 2"), followed by the marquee seeds (Alcaraz #1, Sinner #2, Djokovic #3, Draper #4); `Show more (28)`.

```json
{ "cards": 5, "first": "Live Underdog vs Wildcard Entrant — live", "showMore": "Show more (28)" }
```

_Screenshots captured during this verification session: (1) the five collapsed sections; (2) Men's Singles expanded with the live match pinned first, then top seeds, then "Show more". Reproduce with the steps above._

## Artifact: "Show more" reveals five more

**Reproduce:** with Men's Singles expanded, click the "Show more" button, then re-read the counts.

**Result summary:** Visible cards go 5 → 10 and the control updates to `Show more (23)`.

```json
{ "menCards": 10, "showMore": "Show more (23)" }
```

## Artifact: Full CI gate set + build

**Command:**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build
```

**Result summary:** Lint 0 errors (2 pre-existing warnings in `scripts/verify-tennis-endpoints.ts`, unrelated to this spec); format clean; typecheck clean; 360/360 tests; production build succeeds.

```
 Test Files  36 passed (36)
      Tests  360 passed (360)
```

## Reviewer Conclusion

With a realistic 32 + 32 draw, the tournament card groups matches into five discipline/gender dropdowns, surfaces the top 5 by seed-based priority with live matches pinned first, and pages the rest via "Show more" — verified live in the browser and backed by 360 passing tests and a green production build.
