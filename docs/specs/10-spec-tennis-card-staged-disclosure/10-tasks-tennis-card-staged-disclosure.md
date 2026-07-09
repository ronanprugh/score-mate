# 10-tasks-tennis-card-staged-disclosure.md

Implementation tasks for [`10-spec-tennis-card-staged-disclosure.md`](10-spec-tennis-card-staged-disclosure.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/home/tennis-card-stages.ts` | **New.** Pure module: derive ordered reveal families from `MatchGroup[]`, total stage count, cumulative `sectionsForStage(stage)`, and `stageHint(stage)`. Core of Unit 1. |
| `lib/home/tennis-card-stages.test.ts` | **New.** Unit tests for the stage logic (both-families, singles-only, doubles-only, no-sections, wrap cycle). |
| `lib/home/tennis-priority.ts` | Existing. Reuse `SectionKey`, `SECTION_ORDER`, `MatchGroup`, `groupMatches` for classification/order; the singles/doubles family split is defined against its `SectionKey`s. |
| `components/tournament-card.tsx` | Existing. Add `stage` state + single header toggle, chevron, stage hint, `aria-expanded`, and gated rendering of sections per stage. Core of Unit 2. |
| `components/tournament-card.test.tsx` | Existing. **Revise** — current tests assert the old always-visible / no-toggle behavior; update to the staged model and add new-behavior cases. |
| `components/match-group-section.tsx` | Existing. Unchanged; rendered by the card once a section is revealed. Referenced to confirm no regression to per-section behavior. |
| `app/dev-fixture/tennis-day/page.tsx` | Existing fixture used to capture before/after screenshots of the staged reveal (proof artifacts). |

### Notes

- Colocate tests next to source (`foo.ts` ↔ `foo.test.ts`), per repo convention.
- Run a single test file with `pnpm test:ci <path>`; full suite with `pnpm test:ci`.
- Client components keep the `"use client"` directive; TS `strict`, no `any`, no untracked `@ts-ignore`.
- Follow Tailwind v4 mobile-first + ≥44px touch-target conventions; reuse the existing chevron SVG pattern from `match-group-section.tsx`.
- Commit with Conventional Commits, referencing this spec/task in the body.

## Tasks

### [x] 1.0 Pure staged-reveal logic (stages, cumulative sections, hint)

Introduce a pure, framework-free module that turns a tournament's `MatchGroup[]`
(from `groupMatches`) into ordered reveal families, a total stage count, a
per-stage cumulative section selector, and a stage-hint label — the deterministic
core that Unit 2 renders. Covers Spec Unit 1.

#### 1.0 Proof Artifact(s)

- Test: `lib/home/tennis-card-stages.test.ts` passes — demonstrates reveal-step computation for both-families, singles-only, doubles-only, and no-sections tournaments.
- Test: assertion that stage-1 sections for a both-families input contain only `mens-singles`/`womens-singles` keys demonstrates doubles are withheld until stage 2.
- Test: assertion that advancing past the final stage returns to stage 0 demonstrates the wrap-to-collapsed cycle.
- CLI: `pnpm test:ci lib/home/tennis-card-stages.test.ts` output showing green demonstrates the logic is verified in isolation.

#### 1.0 Tasks

- [x] 1.1 Create `lib/home/tennis-card-stages.ts`. Define `SINGLES_KEYS` and `DOUBLES_KEYS` as the partition of `SectionKey` (singles = `mens-singles`, `womens-singles`; doubles = `mens-doubles`, `womens-doubles`, `mixed-doubles`), importing `SectionKey`/`MatchGroup`/`SECTION_ORDER` from `tennis-priority.ts`.
- [x] 1.2 Implement `revealFamilies(groups: MatchGroup[]): MatchGroup[][]` that returns the present families in fixed order (singles family first, then doubles family), each family being its member groups in `SECTION_ORDER`, omitting any family with zero groups.
- [x] 1.3 Implement `totalStages(groups): number` = `1 + revealFamilies(groups).length` (1 when no classifiable sections).
- [x] 1.4 Implement `sectionsForStage(groups, stage): MatchGroup[]` returning the cumulative union of families for stages `1..N` (empty at stage 0), preserving `SECTION_ORDER`.
- [x] 1.5 Implement `nextStage(groups, stage): number` = `(stage + 1) % totalStages(groups)` so advancing past the final stage wraps to 0.
- [x] 1.6 Implement `stageHint(groups, stage): string` → `""` at stage 0; a label reflecting revealed families (e.g. `"Singles"`, `"Singles + Doubles"`, or `"Doubles"` for a doubles-only event). Derive the label from which families are visible, not hardcoded per tournament.
- [x] 1.7 Write `lib/home/tennis-card-stages.test.ts` covering: both-families (3 stages; stage 1 = singles keys only; stage 2 = singles+doubles), singles-only (2 stages), doubles-only (2 stages; stage 1 shows doubles), no-sections (1 stage), `nextStage` wrap from final → 0, and `stageHint` strings per stage.
- [x] 1.8 Run `pnpm test:ci lib/home/tennis-card-stages.test.ts` and confirm green.

### [x] 2.0 Tournament card staged interaction & UI

Wire the staged-reveal logic into `TournamentCard`: collapsed by default, a single
header toggle that cycles collapsed → singles → singles+doubles → collapsed, a
discoverable chevron + stage hint, `aria-expanded` state, graceful singles-only /
doubles-only / no-sections handling, and unchanged per-section `MatchGroupSection`
behavior. Covers Spec Unit 2.

#### 2.0 Proof Artifact(s)

- Test: `components/tournament-card.test.tsx` passes — demonstrates collapsed default (zero `match-group` elements), singles-only after first activation, singles+doubles after second, and collapse on the wrap click.
- Test: assertion that `aria-expanded` toggles and the stage-hint text updates across clicks demonstrates the accessible, discoverable control.
- Test: assertion that a no-classifiable-sections tournament renders a non-interactive header (no toggle button) demonstrates graceful degradation.
- Screenshot: `app/dev-fixture/tennis-day` card shown collapsed, after one tap (singles only), and after a second tap (singles + doubles) demonstrates the end-to-end staged reveal.

#### 2.0 Tasks

- [x] 2.1 In `tournament-card.tsx`, compute `groups = groupMatches(matches)` and `stages = totalStages(groups)`; add `const [stage, setStage] = useState(0)`.
- [x] 2.2 Make the header a single toggle `button` (only when `stages > 1`) that calls `setStage((s) => nextStage(groups, s))`, sets `aria-expanded={stage > 0}`, and keeps the existing name/date/round/counts content and ≥44px (`min-h-11`) target.
- [x] 2.3 Add the chevron SVG (reuse the `match-group-section.tsx` rotate pattern) and render `stageHint(groups, stage)` as a muted `text-xs` label in the header; follow the `hidden … sm:block` pattern if width-constrained.
- [x] 2.4 Render only `sectionsForStage(groups, stage)` as `MatchGroupSection`s (each still collapsed-by-default, unchanged); render nothing below the header at stage 0.
- [x] 2.5 When `stages === 1` (no classifiable sections), render the header as plain non-interactive markup (no button, no chevron, no `aria-expanded`), matching today's no-sections output.
- [x] 2.6 Revise `components/tournament-card.test.tsx`: update the existing `(b)`/`(c)`/`(c3)`/`(c4)`/`(e)` cases to the staged model (collapsed default, activate to reveal), and add cases for: zero sections at stage 0, singles-only after 1 click, singles+doubles after 2 clicks, wrap-to-collapsed on 3rd click, `aria-expanded`/hint updates, and non-interactive header for no-sections. Also add: (i) a **doubles-only** tournament renders its doubles sections after the first activation (component-level coverage of the logic-layer path); and (ii) a **remount/reset** assertion — re-rendering a fresh `TournamentCard` returns to stage 0 (zero `match-group`), guarding the ephemeral-state requirement against future lifted/persisted-state regressions.
- [x] 2.7 Run `pnpm test:ci components/tournament-card.test.tsx` and confirm green.
- [x] 2.8 Start the dev server, open the tennis-day fixture, and capture screenshots at each stage (collapsed → singles → singles+doubles) for the proof artifacts.

### [ ] 3.0 Quality gates & end-to-end proof capture

Run the full CI-equivalent gate set and capture the before/after visual proof so
the change is validated exactly as CI and a reviewer would see it. Covers Spec
Success Metrics and the repo quality gates.

#### 3.0 Proof Artifact(s)

- CLI: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci` output all green demonstrates every repo quality gate passes.
- CLI: `pnpm build` succeeds demonstrates no build/type regressions from the client-component change.
- Screenshot: home feed (or tennis-day fixture) showing a collapsed-by-default tournament card demonstrates the default-compactness success metric.

#### 3.0 Tasks

- [ ] 3.1 Run `pnpm lint` and `pnpm format:check`; fix any issues (run `pnpm format` if needed).
- [ ] 3.2 Run `pnpm typecheck`; resolve any type errors (no `any`, no untracked suppressions).
- [ ] 3.3 Run `pnpm test:ci` (full suite) and confirm all tests green, including untouched neighbors.
- [ ] 3.4 Run `pnpm build` and confirm it succeeds.
- [ ] 3.5 Capture the collapsed-default screenshot and save proof artifacts under `docs/specs/10-spec-tennis-card-staged-disclosure/10-proofs/`.
