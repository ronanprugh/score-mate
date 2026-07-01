# 08-tasks-tennis-discipline-grouping.md

Tasks for [08-spec-tennis-discipline-grouping.md](08-spec-tennis-discipline-grouping.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/sports/types.ts` | Add `seed?: number` to `TennisPlayerLine` (the player-line shape consumed everywhere). |
| `lib/espn/tennis.ts` | Parse per-competitor seed (`curatedRank.current`) into `TennisPlayerLine.seed` in `buildTennisPlayerLine`; add the raw `curatedRank` field to the raw-shape interface. |
| `lib/espn/tennis.test.ts` | Unit tests for seed parsing (present + absent) against the new fixture. |
| `lib/espn/__fixtures__/tennis-scoreboard.json` | New committed ESPN scoreboard fixture (public data) proving the `curatedRank.current` field exists and enabling deterministic parser tests. |
| `lib/home/tennis-priority.ts` | New pure module: draw classification, side-ranking (incl. doubles average), priority formula, section ordering + grouping, and the `INITIAL_VISIBLE`/`SHOW_MORE_STEP`/`UNRANKED_SENTINEL`/section-order constants. |
| `lib/home/tennis-priority.test.ts` | Unit tests for the priority formula, doubles-average, classification, exclusion, and ordering. |
| `components/match-group-section.tsx` | New client sub-component: one collapsible discipline/gender section with top-5 render, "Show more" (+5), live-pinning, and collapse-reset. |
| `components/match-group-section.test.tsx` | Component tests for collapse default, ≤5 initial, show-more, exhaustion, collapse-reset, live-first. |
| `components/tournament-card.tsx` | Restructure the expanded body to render grouped `MatchGroupSection`s (from `tennis-priority` grouping) instead of the flat match grid; keep header unchanged. |
| `components/tournament-card.test.tsx` | Update existing tests to the grouped structure; add label/count + empty-section-omission + header-unchanged cases. |
| `components/tennis-match-card.tsx` | Reference only — reused unchanged per match; confirm no change needed. |
| `app/dev-fixture/tennis-day/page.tsx` | Extend the dev fixture with a 32+32 ranked draw (and a live match) to screenshot grouping, truncation, and live pinning. |

### Notes

- Colocate Vitest tests next to source (`foo.ts` ↔ `foo.test.ts`), matching the existing repo pattern.
- Run a single test file with `pnpm test:ci <path>` (e.g. `pnpm test:ci lib/home/tennis-priority.test.ts`); run the full suite with `pnpm test:ci`.
- All CI gates must pass before handoff: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`.
- TypeScript `strict`: no `any`, no unguarded `@ts-ignore`. Keep `lib/home/tennis-priority.ts` DB-free (mirror `tennis-aggregator.ts`).
- Commit per parent task using Conventional Commits, referencing this spec (e.g. `Related to T2.0 in Spec 08-spec-tennis-discipline-grouping`).

## Tasks

### [x] 1.0 Add player world ranking to the tennis data model (spike + parse)

#### 1.0 Proof Artifact(s)

- Fixture: `lib/espn/__fixtures__/tennis-scoreboard.json` committed with a per-competitor `curatedRank.current` present demonstrates the ESPN source field exists (Unit 1 / Open Question 1 — RESOLVED: field is tournament seed, not world ranking).
- Test: `lib/espn/tennis.test.ts` passes a case asserting `match.tennis.home.seed` / `away.seed` are populated from the fixture, and left `undefined` when the competitor has no `curatedRank`, demonstrating parsing + graceful absence.
- Diff: `lib/sports/types.ts` showing the new `TennisPlayerLine.seed?: number` field demonstrates the model change.
- CLI: `pnpm typecheck` passes demonstrates the new field integrates without type errors.

#### 1.0 Tasks

- [x] 1.1 **Spike (DONE 2026-07-01):** fetched the live ESPN ATP scoreboard. Result: no world ranking anywhere; the only ranking-like field is `competitor.curatedRank.current` = **tournament seed** (1–32, seeded players only). Per user decision, use the seed. Field path confirmed: `events[].groupings[].competitions[].competitors[].curatedRank.current`.
- [x] 1.2 Save a trimmed, public sample of the payload as `lib/espn/__fixtures__/tennis-scoreboard.json` — include ≥2 competitors with `curatedRank.current` and ≥1 without. Keep only fields the parser reads plus `curatedRank`.
- [x] 1.3 Add `seed?: number` to `TennisPlayerLine` in `lib/sports/types.ts` with a doc comment ("Tournament seed from ESPN `curatedRank.current`; lower = better; undefined when unseeded").
- [x] 1.4 Add `curatedRank` to the raw-shape interface (`RawTennisCompetitor` / add `RawTennisCuratedRank`) in `lib/espn/tennis.ts` and populate `seed` inside `buildTennisPlayerLine` (line ~339) from `competitor.curatedRank?.current`, leaving it `undefined` when absent (no sentinel at parse time).
- [x] 1.5 Add tests in `lib/espn/tennis.test.ts` (create the file if absent) that parse the fixture and assert: (a) a seeded competitor yields the expected `seed`; (b) an unseeded competitor yields `seed === undefined`.
- [x] 1.6 Run `pnpm typecheck` and `pnpm test:ci lib/espn/tennis.test.ts`; commit (`feat(tennis): parse player tournament seed`).

### [x] 2.0 Implement ranking-weighted priority + discipline/gender grouping logic (pure lib)

#### 2.0 Proof Artifact(s)

- Test: `lib/home/tennis-priority.test.ts` passes the worked priority examples (#1 vs #3 ≈ 1.67; #1 vs #150 = 34; #50 vs unranked = 66.7; #120 vs #150 = 130; both unranked = 9999) demonstrates the formula + cap rule.
- Test: `lib/home/tennis-priority.test.ts` case asserting a doubles/mixed side ranking of `102.5` for singles ranks 5 and 200 demonstrates the doubles-average rule.
- Test: `lib/home/tennis-priority.test.ts` cases asserting classification into all five section keys, exclusion of an unclassifiable draw, and priority-then-kickoff-then-id ordering within a section.

#### 2.0 Tasks

- [x] 2.1 Create `lib/home/tennis-priority.ts` with exported constants: `UNRANKED_SENTINEL = 9999`, `INITIAL_VISIBLE = 5`, `SHOW_MORE_STEP = 5`, a `SectionKey` union (`mens-singles | womens-singles | mens-doubles | womens-doubles | mixed-doubles`), and an ordered `SECTION_ORDER` with display labels.
- [x] 2.2 Implement `classifyDraw(draw: string | undefined): SectionKey | null` — case-insensitive parse of `match.tennis.draw`; return the matching key or `null` for unclassifiable/missing draws (wheelchair, juniors, qualifying, etc.).
- [x] 2.3 Implement `sideRank(match, side)` — singles: the player's `seed ?? UNRANKED_SENTINEL`; doubles/mixed: arithmetic mean of the pair's two singles `seed` values (each `?? UNRANKED_SENTINEL`). (Document that a single "side" maps to `tennis.home`/`tennis.away`; doubles partner seeds come from the parsed player lines.)
- [x] 2.4 Implement `matchPriority(match): number` = `(bestRank*2 + adjustedSecondRank)/3` where `bestRank = min(sideRankHome, sideRankAway)`, `otherRank = max(...)`, `adjustedSecondRank = bestRank <= 100 ? Math.min(100, otherRank) : otherRank`.
- [x] 2.5 Implement `compareMatches(a, b)` — priority ascending, then earliest `kickoffUtc` (nulls last), then `id`; and `groupMatches(matches): { key, label, matches }[]` that classifies, drops `null`, sorts each group with `compareMatches`, and returns non-empty groups in `SECTION_ORDER`.
- [x] 2.6 Write `lib/home/tennis-priority.test.ts` covering: the five worked priority values (2.0 proof), the `102.5` doubles-average case, classification into all five keys + exclusion of an unclassifiable draw, ties broken by kickoff then id, and empty-group omission from `groupMatches`.
- [x] 2.7 Run `pnpm test:ci lib/home/tennis-priority.test.ts` and `pnpm typecheck`; commit (`feat(tennis): match priority + discipline grouping`).

### [x] 3.0 Render grouped dropdown sections with top-5 / show-more / live pinning (UI)

#### 3.0 Proof Artifact(s)

- Test: `components/match-group-section.test.tsx` passes cases for collapsed-by-default, expands to ≤5 matches, "Show more" reveals 5 more then hides when exhausted, collapse resets visible count, a live match renders first, and the toggle + "Show more" controls carry `min-h-11` (≥44 px touch target).
- Test: `components/tournament-card.test.tsx` passes updated cases asserting non-empty sections render with label + count, empty sections are omitted, and the existing header (name/date/round/counts) is unchanged.
- CLI: `pnpm test:ci` passes demonstrates component + logic behavior with no regression to existing tennis tests.

#### 3.0 Tasks

- [x] 3.1 Create `components/match-group-section.tsx` (`"use client"`) taking `{ label, matches }` (matches already priority-ordered by `groupMatches`). Manage `isOpen` (default `false`) and `visibleCount` (default `INITIAL_VISIBLE`). Reuse the existing chevron/`aria-expanded`/rotate pattern from `tournament-card.tsx`; toggle ≥44px (`min-h-11`).
- [x] 3.2 In the section, order for display = all `status === "live"` matches first (preserving priority order) then the rest; render `min(visibleCount, matches.length)` `TennisMatchCard`s. Show a full-width "Show more (N)" button (`min-h-11`) when `visibleCount < matches.length`; clicking adds `SHOW_MORE_STEP`; hide the button when exhausted. Collapsing (setting `isOpen=false`) resets `visibleCount` to `INITIAL_VISIBLE`.
- [x] 3.3 Render a section label with match count (e.g. "Men's Singles · 32") using existing `text-xs text-zinc-500` styling.
- [x] 3.4 Refactor `components/tournament-card.tsx`: replace the flat `sortedMatches` grid (lines ~38–42, ~96–102) with `groupMatches(matches)` → one `MatchGroupSection` per returned group; render nothing for the body when there are zero classifiable matches. Leave the header block (name/date/round/counts, lines ~49–95) untouched. **Decide `defaultOpen`'s fate explicitly:** the card-level open state is superseded by per-section open state — either (preferred) remove the `defaultOpen` prop and update the two call sites (`app/dev-fixture/tennis-day/page.tsx:106`, `components/home-client.tsx:345`), or repurpose it to pre-open all sections. Record the choice in a code comment.
- [x] 3.5 Write `components/match-group-section.test.tsx`: collapsed by default (`aria-expanded=false`, no match cards); expand → ≤5 cards; "Show more" → +5 and disappears at exhaustion; collapse → visible count resets to 5 on re-expand; a live match appears as the first rendered card; and the toggle button + "Show more" button each carry `min-h-11` (mirrors `tournament-card.test.tsx` case (d)).
- [x] 3.6 Update `components/tournament-card.test.tsx` for the grouped structure: assert sections render with labels + counts, an empty discipline yields no section, a tournament with zero classifiable draws renders no body sections (empty-body edge case), and header assertions ((a)/(a2) date/round/counts) still pass. Remove/replace the obsolete flat-list cases ((c) "one match-card per match", chronological order) with section-scoped equivalents.
- [x] 3.7 Run `pnpm test:ci` (full suite) and `pnpm typecheck`; commit (`feat(tennis): grouped discipline sections with show-more`).

### [x] 4.0 Update dev fixture, capture screenshots, and pass all quality gates

#### 4.0 Proof Artifact(s)

- Screenshot: `/dev-fixture/tennis-day` rendering a 32+32 draw with ranks — showing collapsed sections and one expanded section limited to 5 with a "Show more (N)" control — demonstrates end-to-end grouping + truncation.
- Screenshot: same fixture with a live match expanded, showing the live match pinned first, demonstrates live pinning.
- CLI: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm build` all pass demonstrates the branch meets every CI gate.

#### 4.0 Tasks

- [x] 4.1 Extend `app/dev-fixture/tennis-day/page.tsx`: build a fixture tournament with a Men's Singles and Women's Singles draw of ~32 matches each (with varied `rank` values incl. some unranked), at least one Men's/Women's/Mixed Doubles match, and at least one `status === "live"` match. Keep it dev-only (no nav link).
- [x] 4.2 Start the dev server, open `/dev-fixture/tennis-day`, and capture the two screenshots (collapsed sections + expanded section truncated to 5 with "Show more"; and a live match pinned first). Save under `docs/specs/08-spec-tennis-discipline-grouping/08-proofs/`.
- [x] 4.3 Run the full gate set — `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` — and fix any failures.
- [x] 4.4 Commit (`docs(tennis): proof bundle for Spec 08` + any `feat` fixes); ensure the proof screenshots are committed.
```
