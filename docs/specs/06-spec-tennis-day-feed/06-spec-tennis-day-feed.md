# 06-spec-tennis-day-feed.md

## Introduction/Overview

The tennis feature shipped in Spec 05 only surfaces in-session marquee tournaments on the **Today** tab. The Yesterday and Tomorrow tabs never render tennis at all, and a partially-completed refactor has left the homepage data layer in an inconsistent, non-compiling state. As a result, tennis does not behave the way the homepage design intends: a user who switches to another day tab sees no tennis even when matches were played (or are scheduled) that day.

This spec fixes the tennis day-feed so that **each of the three day tabs (Yesterday, Today, Tomorrow) renders that day's tennis matches grouped into one `TournamentCard` per in-session tournament**, with correct counts, labels, and date bucketing. It also resolves the related correctness bugs uncovered during analysis (UTC-vs-local bucketing, degenerate date range, and wrong "current round" label).

## Goals

- Render tennis tournament cards on all three day tabs (Yesterday, Today, Tomorrow), with each day's matches split by tournament — not just Today.
- Bucket tennis matches into the same local-date day window the rest of the homepage feed uses, so a match lands on the correct tab.
- Complete the per-day tennis data refactor so the project type-checks, lints, and all tests pass.
- Display accurate tournament metadata on each card: correct current round, accurate match counts, and the tournament's date range.
- Keep the existing "only show a tournament on a day it has ≥1 match" behavior the user confirmed.

## User Stories

- **As a tennis fan**, I want to switch to the Yesterday tab and see yesterday's completed tennis matches grouped by tournament, so I can catch up on results I missed.
- **As a tennis fan**, I want the Tomorrow tab to show tomorrow's scheduled tennis matches grouped by tournament, so I can plan what to watch.
- **As a tennis fan on the Today tab**, I want today's live and upcoming matches split by tournament in a tournament card, so the homepage matches the intended design.
- **As any homepage user**, I want a match that happens late at night to appear on the correct day tab for my local timezone, so the feed isn't off by a day.
- **As a maintainer**, I want the homepage data layer to compile and pass its full test suite, so the feature can ship without a broken build.

## Demoable Units of Work

### Unit 1: Per-day tennis aggregation in the home envelope

**Purpose:** Make the homepage data layer fetch and carry tennis for all three days instead of only today, and complete the half-finished `TennisByDay` refactor so the build is green.

**Functional Requirements:**

- The system shall fetch active tennis tournaments for each of `dates.yesterday`, `dates.today`, and `dates.tomorrow` (three calls), in parallel with the existing league fan-out.
- The system shall expose the result on `HomeEnvelope` as a per-day structure (`{ yesterday, today, tomorrow }`), each holding that day's `ActiveTournament[]`.
- The system shall fall back to an empty list for any single day whose tennis fetch rejects, recording the failure in `source.errors` without failing the whole envelope.
- The system shall default the per-day tennis structure to three empty lists in `EMPTY_ENVELOPE` and in the `buildHomeEnvelope` default parameter.
- The system shall update every consumer of the old `activeTennisTournaments: ActiveTournament[]` shape (aggregator, cache wiring, home-client, and all affected tests) to the new per-day shape so `pnpm typecheck` passes.

**Proof Artifacts:**

- CLI: `pnpm typecheck` exits 0 demonstrates the refactor is internally consistent.
- Test: `lib/home/aggregator.test.ts` asserts the envelope carries tennis for each day and that a per-day fetch rejection yields `[]` for that day plus a `source.errors` entry — demonstrates per-day aggregation and partial-failure handling.
- Test: `app/api/home/route.test.ts` updated to the new envelope shape passes — demonstrates the route contract still holds.

### Unit 2: Correct local-day bucketing for tennis matches

**Purpose:** Ensure a tennis match shows up on the day tab that matches the user's local calendar day, consistent with how team-sport matches are already bucketed.

**Functional Requirements:**

- The system shall assign each tennis match to a day tab using the same local-date logic the team-sport feed uses (`localDateOfMatch` against the user's IANA timezone), rather than a raw UTC-date string comparison.
- The system shall ensure a tennis match whose UTC date differs from the user's local date (e.g. a late-evening match) appears on the correct local day tab.
- The system shall continue to include a tournament on a given day only when that day has ≥1 match for it (no empty tournament cards).

**Proof Artifacts:**

- Test: a unit test feeds a tennis match whose `kickoffUtc` falls on the next UTC day but the same local day (or vice versa) and asserts it is bucketed to the expected local day — demonstrates the off-by-one bucketing bug is fixed.
- Test: a fixture with matches on different days asserts each day tab receives only its own matches — demonstrates per-day separation.

### Unit 3: Per-day tennis rendering and accurate card metadata

**Purpose:** Render the tournament cards on every day tab and fix the metadata bugs so each card reads correctly.

**Functional Requirements:**

- The system shall render one `TournamentCard` per in-session tournament on the Yesterday, Today, and Tomorrow tabs, with that day's matches shown (split by tournament) when the card is expanded.
- The system shall include tennis tournaments in each day tab's count badge and in the homepage empty-state decision, so a day with tennis but no team matches is not shown as empty.
- The system shall derive each card's "current round" from the match's actual round (e.g. "Quarterfinals"), not the draw/grouping name (e.g. "Men's Singles").
- The system shall display each tournament card's date range as the tournament's overall run, not the single rendered day.
- The system shall preserve the existing `TennisMatchCard` layout (stacked players, per-set games, tiebreaks, best-of, draw/round, court, flags) for the matches inside an expanded card.

**Proof Artifacts:**

- Test: `components/home-client.test.tsx` asserts tournament cards render on the Yesterday and Tomorrow tabs (not only Today) when those days have tennis, and are absent when they don't — demonstrates the core fix.
- Test: `components/tournament-card.test.tsx` asserts the card shows the actual round and the tournament date range — demonstrates the metadata fixes.
- Screenshot: the Yesterday tab during a live tournament window showing a tournament card with that day's completed matches when expanded — demonstrates the end-to-end design.

## Non-Goals (Out of Scope)

1. **Days outside the three-day window**: no tennis history or schedule beyond yesterday/today/tomorrow.
2. **Empty tournament cards**: a tournament with zero matches on a given day is not shown on that day (confirmed by the user — keep current behavior).
3. **Team-sport rendering changes**: the existing `MatchCard` and league-grouping behavior for non-tennis sports is unchanged except where required to thread per-day tennis through.
4. **New tennis scope**: no ATP/WTA 250 events, no player favorites, no doubles, no live point-level scores, no bracket/draw views (Spec 05 non-goals still apply).
5. **Caching strategy redesign**: reuse the existing 1-hour `unstable_cache` layer; the only change is calling it per day (three date-keyed entries).
6. **Visual redesign of the cards**: the `TennisMatchCard` and `TournamentCard` visual designs are already approved; this spec only fixes which days they appear on and the correctness of their metadata.

## Design Considerations

- Tennis tournament cards should appear on each day tab in a layout consistent with that tab. The Today tab already interleaves tournament cards into its sorted feed; the Yesterday/Tomorrow tabs group team matches by league. Tournament cards should be placed consistently (e.g. as full-width cards above or within the day's content) so the three tabs feel uniform.
- On the Yesterday tab all tennis matches will be `final`; on Tomorrow all `upcoming`; on Today a mix. The card's "N live · M upcoming · K done" counts should reflect that day's matches.
- Tournament cards span the full row width so their expandable match grid (responsive multi-column) has room.

## Repository Standards

- Next.js 16 App Router; server components by default, `"use client"` only where local state is needed (`TournamentCard`).
- TypeScript `strict`, no `any`, no unjustified `@ts-ignore`.
- Tailwind v4 mobile-first; responsive grids for multi-column desktop layout.
- Vitest + React Testing Library, colocated tests next to source.
- ESLint + Prettier; Conventional Commits with a body referencing the relevant task and `Spec 06-spec-tennis-day-feed`.
- No new runtime dependencies; no DB migration.

## Technical Considerations

- **Complete the `TennisByDay` refactor consistently.** `HomeEnvelope.activeTennisTournaments` is mid-migration from `ActiveTournament[]` to `{ yesterday, today, tomorrow }`. All producers (`buildHomeEnvelope`, `aggregateMatchesForUser`, `EMPTY_ENVELOPE`) and consumers (`home-client.tsx`, `home-client.test.tsx`, `aggregator.test.ts`, `app/api/home/route.test.ts`) must move to the new shape in one coherent change.
- **Local vs UTC bucketing.** `tennisScoreboard(id, date)` currently filters ESPN competitions with a strict UTC `comp.date.slice(0,10) === date` comparison, where `date` is the user's *local* day string. The team-sport path instead fetches a widened window and buckets by `localDateOfMatch`. Tennis should follow the same local-date bucketing so matches near midnight land on the correct tab. Implementation options to evaluate during task planning: (a) widen the tennis fetch to adjacent dates and bucket by local date in the aggregator, or (b) bucket the three per-day fetches by local date after fetching. Pick the approach that keeps ESPN call volume bounded and reuses `localDateOfMatch`.
- **ESPN ignores `dates=` and returns the whole draw.** This was handled in Spec 05 by client-side date filtering plus ATP/WTA dedupe; those safeguards must remain intact and be re-verified.
- **Date-range source.** Because each per-day fetch is filtered to one day, `ActiveTournament.startDate/endDate` collapse to that day. To show the tournament's overall run, capture the min/max competition date from the unfiltered ESPN event response (the whole-draw payload) or another stable source, rather than from the filtered match list.
- **Current-round source.** `match.tennis.round` (from ESPN `round.displayName`) holds the real round; `match.round` holds the draw/grouping name. Derive the card's `currentRound` from the former.
- **Cache.** `cachedActiveTennisTournaments(day)` is already keyed by date, so three per-day calls produce three distinct cache entries; the 1-hour revalidate is unchanged. Net effect is up to 3× the marquee fan-out, still cached.

## Security Considerations

- ESPN's tennis API is unauthenticated; no new keys or tokens are introduced.
- No user-supplied input flows into ESPN URLs — tournament ids remain the hardcoded marquee set.
- Proof-artifact screenshots must be redacted if they incidentally capture the user's email in the account menu.
- No new sensitive data is added to the favorites schema.

## Success Metrics

1. **Per-day coverage:** on a date where a marquee tournament has matches yesterday, today, and tomorrow, each tab shows that tournament's card with only that day's matches when expanded. Verified by component tests + a screenshot.
2. **Correct bucketing:** a tennis match whose local date differs from its UTC date appears on the correct local-day tab. Verified by a unit test.
3. **Accurate metadata:** the tournament card shows the real current round and the tournament's full date range, not a single day. Verified by a tournament-card test.
4. **Green build:** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build` all exit 0.
5. **No regressions to team sports:** existing non-tennis homepage tests continue to pass unchanged.

## Open Questions

1. **Tournament-card placement on Yesterday/Tomorrow tabs:** should tennis cards sit above the league-grouped team matches, or be interleaved like the Today tab's sorted feed? Default assumption: full-width cards at the top of the day's content for visual consistency; confirm during task planning if a different placement is preferred.
2. **Date-range display source:** confirm whether the tournament's overall run should come from the unfiltered ESPN event date span or a value added to the marquee registry. Default assumption: derive from the unfiltered ESPN response to avoid hardcoding dates that drift year to year.
