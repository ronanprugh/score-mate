# 08-spec-tennis-discipline-grouping.md

## Introduction/Overview

Today a tennis tournament card on the home feed expands into one flat, chronologically-sorted list of every match. During a Grand Slam a single round can contain 64+ matches (e.g. a 32-match men's draw plus a 32-match women's draw), which is overwhelming and buries the marquee matchups.

This feature restructures the expanded tournament card into **discipline + gender sections** — Men's Singles, Women's Singles, Men's Doubles, Women's Doubles, and Mixed Doubles — each rendered as its own pre-collapsed dropdown. To keep each section glanceable, only the **top 5 matches** are shown initially (ordered by a ranking-weighted priority score so the best matchups surface first), with a **"Show more"** control that reveals five more at a time. Any **live** match is always surfaced at the top of its section regardless of its score.

## Goals

- Split each tournament card's matches into up to five collapsible discipline/gender sections, each collapsed by default.
- Surface the highest-quality matchups first by ranking every match with a deterministic, testable priority score derived from player world rankings.
- Cap each section's initial render at 5 matches with an incremental "Show more" (+5) control, so a 64-match round stays glanceable.
- Always pin live matches to the top of their section so in-progress play is never hidden behind the priority cutoff.
- Add player world-ranking data to the tennis model without regressing the existing card, match-card, or aggregation behavior.

## User Stories

- **As a tennis fan browsing the home feed**, I want men's and women's matches separated into labelled sections so that I can jump straight to the draw I care about instead of scrolling one long mixed list.
- **As a casual viewer during a Grand Slam**, I want the most notable (highest-ranked) matchups shown first and the long tail hidden behind "Show more" so that a 64-match round doesn't overwhelm me.
- **As a live-scores user**, I want any in-progress match to always appear at the top of its section so that I never miss live play because both players are low-ranked.
- **As a doubles follower**, I want doubles and mixed doubles in their own sections, ranked by the pair's combined ranking, so that doubles play is organized the same way as singles.

## Demoable Units of Work

### Unit 1: Player world ranking in the tennis data model

**Purpose:** Make each tennis player's tournament seed available on the `Match` model by parsing it from the ESPN scoreboard payload, so downstream priority scoring has real data. Includes a verification spike to confirm the source field exists.

> **Spike outcome (2026-07-01):** The ESPN tennis scoreboard exposes **no ATP/WTA world ranking**. The only ranking-like field is `competitor.curatedRank.current`, which is the player's **tournament seed** (values 1–32 at a Slam; present only on seeded players, absent for the unseeded). Per user decision, this seed is used as the priority input (lower = better; unseeded → sentinel in the scoring layer). This resolves Open Question 1.

**Functional Requirements:**

- The system shall add an optional `seed?: number` field to `TennisPlayerLine` in `lib/sports/types.ts`, representing the player's tournament seed (lower number = better).
- The system shall parse each competitor's seed from `competitor.curatedRank.current` in the ESPN tennis scoreboard payload in `lib/espn/tennis.ts` and populate `TennisPlayerLine.seed`.
- The system shall leave `seed` undefined when the payload carries no `curatedRank.current` for that competitor (do not invent a value at the parse layer; the sentinel is applied in the scoring layer).
- The system shall record the verified source field and a captured sample payload as a committed test fixture so the parser is covered by a deterministic test.

**Proof Artifacts:**

- Test: `lib/espn/tennis.test.ts` passes with a case asserting `seed` is populated from the fixture, demonstrating the seed is parsed.
- Fixture: `lib/espn/__fixtures__/tennis-scoreboard.json` committed with a `curatedRank.current` present (and an unseeded competitor) demonstrates the source field shape in the real payload.
- Diff: `lib/sports/types.ts` showing the new `seed?: number` field demonstrates the model change.

### Unit 2: Ranking-weighted match priority + discipline/gender grouping (pure logic)

**Purpose:** Provide pure, unit-tested helpers that (a) classify a match into a discipline/gender section, (b) compute each side's ranking (including the doubles "average" rule), (c) compute a match's priority score, and (d) order and group a tournament's matches. No UI in this slice.

**Functional Requirements:**

- The system shall classify each match into exactly one of five sections — `mens-singles`, `womens-singles`, `mens-doubles`, `womens-doubles`, `mixed-doubles` — by parsing `match.tennis.draw` (e.g. "Men's Singles", "Mixed Doubles"); matches whose draw cannot be classified shall be excluded from the grouped output.
- The system shall compute a **side ranking** for each side of a match: for singles, the player's `seed`; for doubles/mixed, the arithmetic mean of the pair's two singles `seed` values.
- The system shall treat any missing player `seed` as the sentinel value `9999` when computing side rankings and priority.
- The system shall compute **match priority** as `(bestRank * 2 + adjustedSecondRank) / 3`, where `bestRank` is the lower (better) of the two side rankings, `adjustedSecondRank = min(100, otherRank)` when `bestRank <= 100`, and `adjustedSecondRank = otherRank` when `bestRank > 100`. Lower priority values rank first.
- The system shall order matches within a section by priority ascending, breaking ties by earliest `kickoffUtc`, then by `match.id`.
- The system shall return sections in a fixed display order (Men's Singles, Women's Singles, Men's Doubles, Women's Doubles, Mixed Doubles) and shall omit sections that contain zero matches.

**Proof Artifacts:**

- Test: `lib/home/tennis-priority.test.ts` passes, including the worked examples in Technical Considerations (e.g. #1 vs #150 → 34; #120 vs #150 → 130; both unranked → 9999), demonstrating the formula and cap rule.
- Test: `lib/home/tennis-priority.test.ts` case asserting a "Mixed Doubles" match with singles ranks 5 and 200 yields a side ranking of `102.5`, demonstrating the doubles-average rule.
- Test: `lib/home/tennis-priority.test.ts` case asserting draw-based classification into all five sections and exclusion of an unclassifiable draw.

### Unit 3: Grouped dropdown sections with top-5 / show-more / live pinning (UI)

**Purpose:** Restructure the expanded tournament card body to render each non-empty section as a pre-collapsed dropdown that shows the top 5 matches, reveals five more per "Show more" click, and always pins live matches to the top of the section.

**Functional Requirements:**

- The system shall render, inside `TournamentCard`, one collapsible sub-section per non-empty discipline/gender group, each collapsed by default, with a label and a match count.
- The system shall, when a section is expanded, order its matches with all live (`status === "live"`) matches first (themselves ordered by the Unit 2 priority ordering), followed by the remaining matches in priority order, and shall render at most 5 matches initially.
- The system shall show a "Show more" control when a section has more than the currently-visible number of matches, revealing 5 additional matches per activation, and shall hide the control once all matches are visible.
- The user shall be able to expand and collapse each section independently, and collapsing a section shall reset its visible count to the initial 5.
- The system shall preserve the existing tournament header (name, date range, current round, and live/upcoming/done counts) unchanged.
- The system shall meet existing mobile-first and touch-target conventions (section toggles and "Show more" control ≥44×44 px, `min-h-11`).

**Proof Artifacts:**

- Test: `components/tournament-card.test.tsx` passes with cases for: sections render collapsed by default; a section expands to show at most 5 matches; "Show more" reveals 5 more; a live match appears first in its section.
- Screenshot: `/dev-fixture/tennis-day` rendering a tournament with a 32+32 draw, showing collapsed sections and an expanded section limited to 5 with a "Show more" control, demonstrates end-to-end grouping and truncation.
- Test: `pnpm test:ci`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass, demonstrating no regression.

## Non-Goals (Out of Scope)

1. **Real-time ranking accuracy / a rankings service**: We use whatever ranking ESPN returns in the scoreboard payload. No separate ATP/WTA ranking API, caching, or historical ranking lookup.
2. **True doubles-team rankings**: Doubles/mixed side ranking is the average of the pair's *singles* rankings, per user decision — not official ATP/WTA doubles rankings.
3. **Cross-tour ranking normalization for mixed doubles**: A man's ATP rank and a woman's WTA rank are averaged directly with no scale adjustment (accepted simplification).
4. **User-configurable section order, page size, or sort**: The five-section order, the top-5 threshold, and the +5 increment are fixed constants in this spec.
5. **Changes to team-sport cards or the non-tennis home feed**: Only the tennis `TournamentCard` and its supporting tennis lib/parse code change.
6. **Persisting expanded/section state across navigation**: Expansion state is component-local and resets on remount, matching current behavior.

## Design Considerations

- Keep the existing tournament-card header (name/date/round/counts) as-is; the body changes from a flat grid to a stack of section dropdowns.
- **Post-implementation UX decision:** the card-level expand/collapse chevron was removed — the section dropdowns render directly under the header (single level of disclosure; only the sections themselves collapse). The `defaultOpen` prop was dropped accordingly.
- Each section dropdown mirrors the existing card's collapse affordance (chevron button, `aria-expanded`, rotate transition) for visual consistency.
- Section labels: "Men's Singles", "Women's Singles", "Men's Doubles", "Women's Doubles", "Mixed Doubles", each with a small match count (e.g. "Men's Singles · 32"), consistent with the existing counts styling (`text-xs text-zinc-500`).
- "Show more" is a full-width, ≥44px-tall text button beneath the visible matches (e.g. "Show more (27)"), styled like existing subtle controls; it disappears when exhausted.
- Empty sections are not rendered at all (an ATP-only 1000 shows only its men's sections).
- Reuse the existing `TennisMatchCard` for each match unchanged.

## Repository Standards

- **Framework/patterns**: Next.js 16 App Router, server components by default; `TournamentCard` stays a `"use client"` component because it holds expansion state. Follow `AGENTS.md`.
- **Language**: TypeScript `strict`; no `any`, no unguarded `@ts-ignore`.
- **Styling**: Tailwind CSS v4, mobile-first; full-height uses `min-h-dvh`; touch targets `min-h-11 min-w-11`.
- **Testing**: Vitest + React Testing Library, colocated `*.test.ts(x)` files next to source. Run `pnpm test:ci` for a single run.
- **Quality gates (CI, `.github/workflows/ci.yml`)**: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` must all pass.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`…); reference the SDD task/spec in the body.
- **Lib organization**: Pure logic in `lib/home/` and `lib/espn/`; keep DB-free helpers free of DB imports (mirror `tennis-aggregator.ts`).

## Technical Considerations

- **Ranking source (spike resolved 2026-07-01)**: ESPN's tennis scoreboard exposes only `competitor.curatedRank.current` — the player's **tournament seed** (1–32 at a Slam, present only on seeded players). There is no world-ranking field. Per user decision the seed is the priority input. Captured sample: `lib/espn/__fixtures__/tennis-scoreboard.json`. Consequence: the "cap at 100" branch below almost never triggers (seeds ≤ ~32), but is retained so the formula is faithful to the request.
- **Sentinel**: Missing `seed` → `9999`, applied only in the scoring layer (`lib/home/tennis-priority.ts`), not at parse time, so raw data stays truthful.
- **Priority formula (authoritative) with worked examples** — `bestRank` = lower of the two side rankings, `otherRank` = higher:
  - `adjustedSecondRank = bestRank <= 100 ? Math.min(100, otherRank) : otherRank`
  - `priority = (bestRank * 2 + adjustedSecondRank) / 3` (lower = shown first)
  - #1 vs #3 → `(2 + 3)/3 ≈ 1.67`
  - #1 vs #150 → `(2 + min(100,150))/3 = (2 + 100)/3 = 34`
  - #50 vs unranked(9999) → `(100 + min(100,9999))/3 = (100 + 100)/3 ≈ 66.7`
  - #120 vs #150 (both > 100) → `(240 + 150)/3 = 130`
  - both unranked → `(19998 + 9999)/3 = 9999`
  - **Assumption (documented):** the "cap at 100" applies to the weaker side's ranking whenever the stronger side is inside the top 100, including when the weaker side is unranked (sentinel). This resolves the "only if facing ranked player" phrasing in the request; if the intended rule differs, flag before implementation.
- **Doubles/mixed side ranking**: `(seedA + seedB) / 2` using each partner's singles `seed` (or `9999` if missing). Example: seeds 5 and 200 → side ranking `102.5`.
- **Classification**: parse `match.tennis.draw` case-insensitively; map "Men's/Women's" + "Singles/Doubles" and "Mixed" to the five section keys; unclassifiable draws (e.g. wheelchair, juniors, qualifying, or missing draw) are excluded from grouped output. This is a behavior change from today's flat list — see Non-Goals and Open Questions.
- **Component structure**: Extract a `MatchGroupSection` client sub-component (collapse state + visible-count state + "Show more") used by `TournamentCard`; keep grouping/sorting in the pure lib so the component stays thin and testable.
- **Constants**: `INITIAL_VISIBLE = 5`, `SHOW_MORE_STEP = 5`, `UNRANKED_SENTINEL = 9999`, and the fixed section order live in `lib/home/tennis-priority.ts`.
- **No new dependencies**: implement with existing React/Tailwind/Vitest stack.

## Security Considerations

- No credentials, tokens, or PII are involved; rankings and player names are public sports data.
- The captured ESPN fixture must contain only public scoreboard data (no API keys or private URLs) before being committed.
- No auth or authorization surface changes.

## Success Metrics

1. **Grouping correctness**: 100% of classifiable matches render under the correct discipline/gender section in unit tests; unclassifiable draws are excluded (verified by tests).
2. **Priority correctness**: All worked-example priority values and the doubles-average case pass exactly in `tennis-priority.test.ts`.
3. **Truncation + live pinning**: A section with >5 matches renders exactly 5 initially, reveals 5 more per "Show more", and always shows a live match first (verified by component tests).
4. **No regression**: `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm build` all pass on the branch.

## Open Questions

1. **Ranking field availability — RESOLVED (2026-07-01):** The spike confirmed the scoreboard carries no world ranking, only `curatedRank.current` (tournament seed). Per user decision the seed is used as the priority input; the model field is named `seed`.
2. **Excluding unclassifiable draws:** Today's flat list shows wheelchair/juniors/qualifying matches; the grouped view excludes them. Confirm this is acceptable (assumed yes per the singles/doubles/mixed framing).
3. **Doubles-average edge case:** When both doubles partners are unranked, the side ranking becomes `9999`, sinking the match to the bottom — acceptable given the sentinel rule, but noted in case a different doubles fallback is preferred later.
