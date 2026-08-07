# 13-spec-teams-match-coverage-and-cards.md

## Introduction/Overview

The Teams destination (`/teams`) frequently shows "Match data unavailable" or a
stale last/next pair for teams that plainly have matches — Liverpool currently
shows nothing at all, despite 38 completed Premier League fixtures, 12 Champions
League fixtures, and 3 preseason friendlies existing upstream. Two independent
defects cause this: the ESPN schedule call omits a season parameter (so during a
season rollover it resolves to an unpublished season and returns zero events),
and the app only ever queries the team's single primary league (so cups,
continental competitions, and friendlies are invisible).

Separately, the Teams list renders each entity as a compact two-line scoreline
that is dense and hard to scan. This spec replaces those rows with the same
match score cards Home uses, so a match reads identically wherever it appears in
the app.

The goal is a Teams screen that reliably shows a followed team's real most-recent
and next match across every competition they play, presented in the app's
established score-card format.

## Goals

- Eliminate the empty-schedule failure caused by ESPN season rollover, for every
  sport, verified against Liverpool.
- Include cup, continental, and friendly fixtures in a followed team's matches,
  not just their primary domestic league.
- Replace the Teams list scoreline rows with Home-style match score cards.
- Hold `/api/teams` warm-median latency at or under the Spec 12 gate of 100 ms
  despite the added upstream fan-out, with before/after evidence.
- Prevent regression via unit tests over the season-fallback and
  multi-competition merge logic, running against recorded fixtures (no live
  network in CI).

## User Stories

- **As a Liverpool supporter**, I want the Teams screen to show my club's most
  recent result and next fixture so that the screen is useful in August, not
  just mid-season.
- **As a fan of a club in cup competitions**, I want a midweek Champions League
  or FA Cup tie to count as my team's "next match" so that the app does not tell
  me my team is idle when they are playing tomorrow.
- **As a preseason follower**, I want friendlies to appear so that there is
  something to look at during the offseason, when they are the only news.
- **As a user scanning my followed teams**, I want each match presented as a
  score card with crests, scores, and competition context so that I can read it
  at a glance in the same visual language as the Home feed.

## Demoable Units of Work

### Unit 1: Season-aware schedule fetching

**Purpose:** Fixes the root cause of the empty Teams screen for every sport, in
the one shared helper both Teams routes already call.

**Functional Requirements:**

- The system shall request a team's schedule with an explicit season parameter
  derived from the current date rather than relying on ESPN's implicit default.
- The system shall, when the current-season request returns zero usable events,
  retry exactly once with the previous season (`currentYear - 1`) and use that
  result.
- The system shall perform at most one fallback retry per (league key, team id)
  pair, so a team genuinely without fixtures does not trigger unbounded lookups.
- The system shall apply this behaviour inside `teamScheduleForLeague`
  ([lib/espn/client.ts:912](lib/espn/client.ts:912)) so that both `/api/teams`
  and `/api/teams/[favoriteId]/matches` inherit it without call-site changes.
- The system shall continue to return an empty array — not throw — when both the
  current and previous season yield nothing, preserving the existing graceful
  "Match data unavailable" degradation.
- The system shall cache the current-season and fallback-season results
  independently, keyed by season, so a fallback result is not served after the
  new season publishes fixtures.

**Proof Artifacts:**

- Test: unit tests over the season-fallback branch, using recorded ESPN fixture
  responses (an empty current-season payload and a populated previous-season
  payload), demonstrate that the retry fires only on an empty result and that
  the second season's events are returned.
- Test: a fixture case where the current season is populated demonstrates that
  no fallback request is issued.
- Screenshot: `/teams` showing Liverpool with a real most-recent result instead
  of "Match data unavailable" demonstrates the user-visible defect is resolved.

### Unit 2: Multi-competition coverage

**Purpose:** Gathers a followed team's matches from every competition a fan
would count, so cups, Europe, and friendlies stop disappearing.

**Functional Requirements:**

- The system shall define a curated companion-league map keyed by primary league
  key, so that a team in `soccer/eng.1` also resolves matches from
  `soccer/club.friendly`, `soccer/eng.fa`, `soccer/eng.league_cup`,
  `soccer/uefa.champions`, `soccer/uefa.europa`, and
  `soccer/uefa.europa.conf`.
- The system shall register `soccer/club.friendly` so that friendly fixtures
  resolve a display name rather than falling back to a raw league key, **without**
  adding it to the set returned by `leagueKeysForSport`
  ([lib/espn/leagues.ts:106](lib/espn/leagues.ts:106)) — that set feeds the Home
  aggregator's fan-out ([lib/home/aggregator.ts:197](lib/home/aggregator.ts:197)),
  and Home must not gain friendly fixtures or extra upstream calls (Non-Goal #8).
- The system shall treat the companion list as empty for sports and leagues that
  have no companions defined, leaving single-league sports unchanged.
- The system shall issue the primary and companion schedule requests
  concurrently, and shall cache each (league key, team id, season) result
  independently.
- The system shall merge the resulting matches into one collection, removing
  duplicates by match id, before selecting the most recent completed and soonest
  upcoming match.
- The system shall tolerate partial upstream failure: a companion league that
  errors or returns nothing shall not prevent the remaining competitions from
  being shown, and shall be recorded in the envelope's `source.errors`.
- The system shall select the chronologically most recent completed match and
  the chronologically soonest upcoming match across all competitions, without
  preferring competitive fixtures over friendlies.

**Proof Artifacts:**

- Test: unit tests over the merge logic, using recorded fixtures from multiple
  league keys, demonstrate deduplication by match id and correct chronological
  selection across competitions.
- Test: a fixture case where one companion league errors demonstrates the
  partial-failure path still returns the remaining matches.
- Screenshot: `/teams` showing a Liverpool card whose most-recent match is a
  preseason friendly, with the competition visible on the card, demonstrates
  non-league fixtures now surface.
- Measurement: before/after `Server-Timing` figures for `/api/teams`, captured
  the same way as `docs/specs/12-spec-performance-optimization/12-baseline-performance.md`,
  demonstrate the latency budget in Technical Considerations holds.

### Unit 3: Teams list score cards

**Purpose:** Makes the Teams list readable by reusing the app's existing match
card instead of a bespoke compact scoreline.

**Functional Requirements:**

- The system shall render each followed entity on `/teams` as a header
  (crest + display name) followed by a last-match card and a next-match card,
  stacked vertically.
- The system shall reuse the existing `MatchCard`
  ([components/match-card.tsx](components/match-card.tsx)) for non-tennis
  entities and `TennisMatchCard` for tennis entities, matching the selection
  logic already used on the entity detail screen
  ([components/entity-matches-client.tsx:12](components/entity-matches-client.tsx:12)).
- The system shall collapse the Teams grid to a single column at all viewport
  widths, since a score card is materially taller than the row it replaces.
- The system shall surface the competition name on each card, so a friendly is
  visibly distinguishable from a league fixture.
- The system shall preserve the existing empty states: per-side copy when one of
  last/next is missing, and a single "Match data unavailable" message when both
  are.
- The system shall keep each entity's header a link to `/teams/[favoriteId]`,
  preserving the existing navigation into the match detail screen.
- The system shall keep the entity header's tap target at or above 44×44 px.

**Proof Artifacts:**

- Test: a component test asserting that a non-tennis entity renders a
  `match-card` testid and a tennis entity renders the tennis card demonstrates
  correct card selection.
- Test: a component test over the both-null entity demonstrates the
  "Match data unavailable" fallback survives the redesign.
- Screenshot: `/teams` at mobile width showing several followed entities as
  stacked score cards demonstrates the redesign end to end.

## Non-Goals (Out of Scope)

1. **Redesigning the entity detail screen**: `/teams/[favoriteId]` already
   renders Home-style match cards (Spec 11); its *presentation* is unchanged by
   this spec. Its *data* is not excluded — it consumes the same shared schedule
   helper, so it inherits the season fallback and multi-competition coverage.
   Leaving it league-only would make the two Teams screens disagree about which
   matches exist, which would read as a new bug.
2. **Friendly/competition filtering controls**: no UI is added to include or
   exclude friendlies; matches are shown chronologically with the competition
   labelled.
3. **Collapsible or persisted per-entity sections**: the list is a plain stacked
   layout with no saved expand/collapse state.
4. **Migrating to the Next.js 16 `use cache` directive**: this spec continues to
   use the `unstable_cache` pattern Spec 12 selected; any migration is its own
   spec.
5. **Extending season fallback to player/athlete schedules**: the fallback is
   implemented in `teamScheduleForLeague`; `athleteSchedule` and
   `athleteMatchHistory` keep their current behaviour.
6. **Multi-competition coverage for player favorites**: player schedules
   continue to resolve from the single league key captured at favorite time.
7. **Refreshing the committed ESPN team catalog**: not required — ESPN soccer
   team ids are shared across soccer league keys, so the existing `externalId`
   resolves against companion leagues without a catalog change.
8. **Changing the Home feed**: Home's aggregation and layout are untouched.

## Design Considerations

- The card visual language is already defined by `MatchCard` and
  `TennisMatchCard`; this spec reuses them rather than introducing a variant.
  Any styling change should go into those shared components so Home and Teams
  stay identical.
- Layout per entity: crest + name header, then the last-match card, then the
  next-match card. Vertical rhythm should match the existing
  `flex flex-col gap-2` spacing used by the detail screen's match list.
- Single column at all breakpoints. The current
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` grid in
  [components/teams-client.tsx:101](components/teams-client.tsx:101) is dropped.
- Mobile-first per repo convention: default utilities target small screens, with
  `sm:`/`md:`/`lg:` used only for larger-viewport adjustments.
- The scroll cost is accepted deliberately: cards are roughly 3× the height of
  the rows they replace, and the user has chosen readability over density.
- Competition labelling rides on `MatchCard`'s existing footer, which already
  renders `round` and `venue`. If a friendly's `round` is absent, the
  competition/league name should be shown there instead.

## Repository Standards

- Next.js 16, App Router, server components by default; client components marked
  `"use client"`. Consult `node_modules/next/dist/docs/` before writing
  framework code.
- TypeScript `strict`; no `any`, no unexplained `@ts-ignore` / `@ts-expect-error`.
- Tailwind CSS v4, mobile-first; `min-h-dvh` for full-height layouts; ≥44×44 px
  touch targets (`min-h-11 min-w-11`).
- Vitest + React Testing Library, tests colocated (`foo.test.tsx` next to
  `foo.tsx`). Network-dependent logic tested against recorded fixtures, matching
  the existing ESPN client tests.
- Quality gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test:ci` — all run in CI via `.github/workflows/ci.yml`.
- Conventional Commits, with the relevant SDD task and spec referenced in the
  commit body.
- ESPN access goes through `lib/espn/client.ts`; league keys are registered in
  `lib/espn/leagues.ts`. Do not add ad-hoc `fetch` calls in route handlers.

## Technical Considerations

- **Response shape change.** `EntityCard` currently consumes the lightweight
  `EntityMatch` summary (`opponentName`, `score`, `result`). `MatchCard`
  requires a full `Match`. `TeamEntity.lastMatch` / `nextMatch` must therefore
  become `Match | null`, and `/api/teams` must stop reducing via
  `extractEntityMatches` ([app/api/teams/route.ts:34](app/api/teams/route.ts:34)).
  For player favorites, `athleteMatchHistory` already returns full `Match`
  objects and should replace the `athleteSchedule` call on this route.
  `EntityMatch` becomes unused once `EntityCard` is rewritten and should be
  removed if nothing else references it.
- **Season derivation.** ESPN's soccer season year is the *starting* year of the
  season (`season=2025` returns the 2025-26 campaign). Other sports differ. The
  implementation should derive the season from the current calendar year and
  rely on the empty-result fallback rather than encoding per-sport calendars.
- **Verified upstream behaviour** (probed 2026-08-05, Liverpool = team `364`):
  `soccer/eng.1/teams/364/schedule` → 0 events;
  `…?season=2025` → 38 events; `soccer/uefa.champions/teams/364/schedule?season=2025`
  → 12 events; `soccer/club.friendly/teams/364/schedule` → 3 events. These are
  the expected values for the recorded test fixtures.
- **Caching.** Continue the Spec 12 pattern: wrap each upstream call in
  `unstable_cache` with `revalidate: 300`, with the season included in the cache
  key. Note that Next.js 16 documents `unstable_cache` as superseded by the
  `use cache` directive; Spec 12 already evaluated that migration and this spec
  intentionally defers to that decision (Non-Goal #4).
- **Latency budget.** Spec 12 left `/api/teams` at a 19 ms warm median against a
  ≤100 ms gate and a ≤600 ms cold gate. This spec increases the cold fan-out
  from 1 request per soccer team to up to 7. Because the requests are issued
  concurrently and cached independently, the warm path should be unaffected.
  The budget for this spec is therefore: **warm median ≤ 100 ms (unchanged)**
  and **cold ≤ 1 200 ms** — an explicit, documented relaxation of the 600 ms
  cold gate as the cost of competition coverage. If a smaller cold budget is
  required, the companion fan-out must be narrowed instead.
- **Fan-out shape.** Companion leagues should be a static map in
  `lib/espn/leagues.ts` (or a sibling module) rather than derived at runtime, so
  the per-team request count is knowable by inspection.
- **Empty companion results are normal.** A team not competing in, say, the
  Europa League returns zero events; this must not set `source.ok = false` or
  surface an error banner. Only genuine request failures count as errors.

## Security Considerations

- No new credentials or secrets. ESPN's site-v2 and core APIs are unauthenticated
  public endpoints already in use.
- Both Teams routes stay auth-gated, and `/api/teams/[favoriteId]/matches`
  retains its user-scoped favorite lookup (unknown id and another user's id both
  yield 404) — the added league fan-out must not introduce any path that
  resolves a favorite outside the signed-in user's own set.
- Recorded ESPN fixtures used for tests contain only public match data; no user
  identifiers, session tokens, or email addresses may be committed alongside
  them.
- Screenshot proof artifacts must not include a real user's email or session
  details in the account menu.

## Success Metrics

1. **Liverpool renders real matches**: `/teams` shows a most-recent completed
   match and, once the 2026-27 fixtures publish, an upcoming one — with zero
   "Match data unavailable" for a team that has fixtures upstream.
2. **Competition coverage**: for a team in cup and continental competitions, the
   selected last/next match is drawn from whichever competition is
   chronologically correct, including friendlies.
3. **No latency regression on the warm path**: `/api/teams` warm median stays
   ≤ 100 ms; cold stays ≤ 1 200 ms, both measured with the Spec 12 methodology.
4. **Regression protection**: unit tests cover the season-fallback branch (fires
   only on empty), the multi-competition merge (dedupe + chronological
   selection), and the partial-failure path; all pass in `pnpm test:ci` without
   network access.
5. **Visual consistency**: a match on `/teams` is rendered by the same component
   as the equivalent match on Home and on the entity detail screen.

## Open Questions

1. Should player/tennis favorites keep a last/next pair on the Teams list, or
   would a single card read better for them given tennis cards are taller? The
   spec currently treats them identically to teams.
2. Non-soccer sports were excluded from the proof artifacts (Q7 answer A). The
   season fallback is implemented generically, but no NFL/NBA/MLB verification
   is required — worth confirming this is acceptable before the offseason for
   those leagues.
3. Whether the 1 200 ms cold budget is acceptable, or whether the companion
   league list should be trimmed to hold a tighter number.
