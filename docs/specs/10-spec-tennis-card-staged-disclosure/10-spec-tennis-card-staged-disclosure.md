# 10-spec-tennis-card-staged-disclosure.md

## Introduction/Overview

Tennis tournament cards on the home feed currently render **every** discipline section (Men's Singles, Women's Singles, and the doubles/mixed draws) beneath the card header at all times, which makes each card tall and noisy before the user has expressed any interest. This feature makes the card reveal its contents in stages driven by repeated taps on the card header: the card starts **collapsed**, the first open reveals only the **singles** sections, and opening again additionally reveals the **doubles** sections (Men's / Women's / Mixed Doubles). The goal is a calmer default home feed where a user progressively drills into a tournament at their own pace.

## Goals

- Tournament cards render **collapsed by default** (header only, no discipline sections shown).
- The **first** expansion reveals only the singles sections; a **second** expansion additionally reveals the doubles/mixed sections.
- A further tap **collapses** the card back to its default state (single control, forward-cycling then wrap to collapsed).
- The staged behavior is **discoverable** via a chevron plus a short stage hint, and gracefully handles tournaments that have only singles or only doubles.
- Existing per-section behavior (each discipline section collapsed-by-default with its own "Show more") is preserved unchanged.

## User Stories

- **As a home-feed user**, I want each tennis tournament to start collapsed so that my feed is compact and I can scan many tournaments quickly without scrolling past match lists I didn't ask for.
- **As a singles-focused fan**, I want the first tap to show me only the singles draws so that I see the matches I care about most without doubles cluttering the view.
- **As a doubles fan**, I want a second tap to additionally reveal the doubles and mixed draws so that I can reach that content when I want it, from the same familiar control.
- **As a casual user**, I want a visible hint that there's more to reveal so that I understand tapping again does something meaningful rather than assuming the card is fully expanded.

## Demoable Units of Work

### Unit 1: Staged reveal logic (collapsed → singles → doubles)

**Purpose:** Establish the pure, testable rules that decide which discipline sections are visible at each stage, independent of React rendering. Serves all users by guaranteeing the reveal order and cycle behavior are correct and deterministic.

**Functional Requirements:**
- The system shall classify the tournament's existing `MatchGroup` sections (from `groupMatches`) into two ordered families: **singles** (`mens-singles`, `womens-singles`) and **doubles** (`mens-doubles`, `womens-doubles`, `mixed-doubles`), preserving the existing `SECTION_ORDER`.
- The system shall compute an ordered list of **reveal steps** from only the families that are actually present for that tournament: a singles step is included only if at least one singles section exists, and a doubles step only if at least one doubles section exists.
- The system shall expose, for a given stage index, the cumulative set of sections visible at that stage (stage 0 = none; stage 1 = first present family; stage 2 = first + second present family).
- The system shall define the total number of stages as `1 + (number of present families)`, so a tournament with both families has 3 stages (0,1,2), a singles-only or doubles-only tournament has 2 stages (0,1), and a tournament with no classifiable sections has 1 stage (0, collapsed only).
- The system shall advance the stage on each activation and, when advancing past the final stage, wrap back to stage 0 (collapsed).
- The system shall provide a human-readable **stage hint** describing what is currently shown (e.g. `Singles`, `Singles + Doubles`, or `Doubles` for a doubles-only tournament; empty/absent when collapsed).

**Proof Artifacts:**
- Test: `lib/home/tennis-card-stages.test.ts` passes — demonstrates reveal-step computation for both-families, singles-only, doubles-only, and no-sections tournaments, plus the wrap-to-collapsed cycle.
- Test: assertion that stage-1 visible sections for a both-families tournament contain only singles keys demonstrates doubles are withheld until stage 2.

### Unit 2: Tournament card staged interaction & UI

**Purpose:** Wire the staged reveal logic into `TournamentCard` so the whole card expands/collapses from a single header control, with a discoverable affordance. Serves end users on the home feed.

**Functional Requirements:**
- The tournament card shall render **collapsed by default**, showing only the existing header (name, date range, round, counts) and no discipline sections.
- The card header shall act as a single toggle control that advances the stage on each activation and wraps back to collapsed after the final stage, per Unit 1.
- On stage 1 the card shall render only the singles sections; on stage 2 (when present) it shall additionally render the doubles/mixed sections; each rendered section shall remain an independent `MatchGroupSection`, collapsed by default with its existing "Show more" behavior unchanged.
- For a singles-only tournament the control shall offer only one expanded stage (singles); for a doubles-only tournament the single expanded stage shall show the doubles sections directly.
- The header control shall display a **chevron** indicating expandability and a short **stage hint** reflecting the current stage, so users can tell more content is available on the next tap.
- The header control shall expose accessible state via `aria-expanded` (true whenever the card is at any stage above collapsed) and shall meet the repo's ≥44px touch-target and mobile-first styling conventions.
- Stage state shall be ephemeral per card (React state), resetting to collapsed on data refresh/remount; no persistence across sessions.
- A tournament with no classifiable sections shall render as a non-interactive header (no chevron/toggle), matching today's "no sections" outcome.

**Proof Artifacts:**
- Test: `components/tournament-card.test.tsx` passes — demonstrates collapsed default (no sections), singles-only after first activation, singles+doubles after second, and collapse on the wrap click.
- Test: assertion that `aria-expanded` toggles and the stage hint text updates across clicks demonstrates the accessible, discoverable control.
- Screenshot: home feed (or `app/dev-fixture/tennis-day`) showing a card collapsed, then after one tap (singles only), then after a second tap (singles + doubles) demonstrates the end-to-end staged reveal.

## Non-Goals (Out of Scope)

1. **Changing per-section internals**: the `MatchGroupSection` collapsed-by-default behavior, live-match pinning, `INITIAL_VISIBLE`, and "Show more" stepping are unchanged.
2. **Match classification / priority changes**: draw classification, seeding, and priority ordering in `tennis-priority.ts` are reused as-is; no ranking or grouping rule changes.
3. **Persistence of stage state**: no localStorage/URL/server persistence of a card's stage across refreshes or sessions.
4. **Auto-expanding sections**: revealing a stage shows section headers only; it does not auto-open the sections or their match lists.
5. **Applying staged disclosure to non-tennis cards** or to other surfaces (entity/favorites pages) — this spec covers the home-feed tournament card only.
6. **New animations/transitions** beyond the existing chevron rotate; no bespoke height-animation work required.

## Design Considerations

- Mobile-first Tailwind v4, consistent with the current card: the header remains a full-width `min-h-11` tappable control; the chevron reuses the existing rotate-on-expand SVG pattern from `MatchGroupSection`.
- The **stage hint** is a small, muted text label (e.g. `text-xs text-zinc-500 dark:text-zinc-400`) placed in the header so it reads as secondary to the tournament name; it should truncate/hide gracefully on very narrow widths without breaking layout (follow the existing `hidden … sm:block` pattern used for the round label if space-constrained).
- Chevron orientation: pointing down when collapsed, rotating as stages advance (a single consistent "expanded" rotation is acceptable; the stage hint carries the "there's more" signal).
- Preserve existing card chrome (border, padding, shadow, dark-mode variants) exactly; this is a behavioral layer over the current markup.

## Repository Standards

- Next.js 16 App Router; `TournamentCard` and `MatchGroupSection` remain client components (`"use client"`).
- TypeScript `strict`, no `any`, no unjustified `@ts-ignore`.
- Pure logic (stage computation) lives under `lib/home/` with a colocated Vitest test; component tests colocated as `*.test.tsx` with React Testing Library.
- Reuse existing exports from `lib/home/tennis-priority.ts` (`SECTION_ORDER`, `SectionKey`, `groupMatches`) rather than duplicating classification.
- Tailwind mobile-first, `min-h-dvh`/safe-area conventions where relevant, ≥44px touch targets.
- Conventional Commits (e.g. `feat(tennis): staged disclosure on tournament cards`), referencing the relevant task and this spec in the body.
- All PR quality gates apply: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci`.

## Technical Considerations

- Introduce the reveal-step/stage computation as a **pure function** (e.g. in `lib/home/tennis-card-stages.ts`) that takes the `MatchGroup[]` from `groupMatches` and returns the ordered families present, the total stage count, a `sectionsForStage(stage)` selector, and a `stageHint(stage)` label. Keeping it pure makes Unit 1 fully unit-testable without rendering.
- `TournamentCard` holds a single `stage` number in `useState` (default 0) and cycles it via `setStage((s) => (s + 1) % totalStages)`. `totalStages` derives from the computed families, so singles-only/doubles-only naturally yield a 2-state cycle and no-sections yields a 1-state (always collapsed, non-interactive) card.
- `aria-expanded` = `stage > 0`. Guard the toggle so a card with `totalStages === 1` renders no interactive control.
- Family ordering must respect the existing `SECTION_ORDER` so within a revealed stage the sections keep their canonical order (Men's Singles before Women's Singles, etc.).
- No changes to data fetching, aggregation, or the ESPN client; this is presentation-only. Because home data refreshes remount/re-render cards, ephemeral stage state resetting to collapsed on refresh is the expected, acceptable behavior.

## Security Considerations

No specific security considerations identified. This is a client-side presentation change over already-fetched, non-sensitive public tournament data; no new inputs, credentials, network calls, or persisted data are introduced. Proof screenshots contain only public sports fixtures.

## Success Metrics

1. **Default compactness**: a rendered tournament card shows 0 discipline sections until the user activates it (verified by test asserting no `match-group` elements at stage 0).
2. **Correct staged reveal**: for a both-families tournament, stage 1 renders only singles sections and stage 2 renders singles + doubles (verified by component test).
3. **Graceful degradation**: singles-only and doubles-only tournaments expose exactly one expanded stage with the correct sections, and a no-sections tournament renders a non-interactive header (verified by tests).
4. **Quality gates green**: `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci` all pass on the change.

## Open Questions

No open questions at this time.
