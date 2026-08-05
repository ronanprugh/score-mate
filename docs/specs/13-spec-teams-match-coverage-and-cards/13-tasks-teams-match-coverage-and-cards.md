# 13-tasks-teams-match-coverage-and-cards.md

Task list for [`13-spec-teams-match-coverage-and-cards.md`](13-spec-teams-match-coverage-and-cards.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/espn/client.ts` | Holds `teamScheduleForLeague` and `buildTeamScheduleUrl` — where the season parameter and the single previous-season fallback are implemented (Task 1.0). |
| `lib/espn/client.test.ts` | Existing ESPN client tests. New season-fallback cases go here, using the established `routedFetch` / `fetchFn` injection pattern. |
| `lib/espn/leagues.ts` | New `COMPANION_ONLY_LEAGUES` list (holds `soccer/club.friendly`), `COMPANION_LEAGUE_KEYS` map, and `companionLeagueKeys()` helper live here (Task 2.0). |
| `lib/home/aggregator.ts` | **Read-only reference.** Line 197 fans out over `leagueKeysForSport(sport)`; this is why `club.friendly` must not join `SUPPORTED_LEAGUES` (Non-Goal #8). |
| `lib/espn/leagues.test.ts` | Tests for the new companion-league map and the `club.friendly` registration. |
| `lib/teams/schedule.ts` | Home of `splitAndCapSchedule`. Gains the shared `teamScheduleAcrossCompetitions` fan-out + merge/dedupe helper used by both Teams routes (Task 2.0). |
| `lib/teams/schedule.test.ts` | **New.** Unit tests for the merge, dedupe, partial-failure, and empty-companion behaviour. |
| `lib/teams/types.ts` | `TeamEntity.lastMatch` / `nextMatch` change from `EntityMatch` to `Match`; `EntityMatch` is removed once unreferenced (Task 3.0). |
| `app/api/teams/route.ts` | Drops `extractEntityMatches`, calls the shared fan-out helper, and switches the player path to `athleteMatchHistory` (Tasks 2.0, 3.0). |
| `app/api/teams/route.test.ts` | Existing route tests; updated for the full-`Match` envelope and the player-path swap. |
| `app/api/teams/[favoriteId]/matches/route.ts` | Shares `teamScheduleForLeague`, so it inherits Task 1.0 and is switched to the shared fan-out helper in Task 2.0 for coverage parity. |
| `app/api/teams/[favoriteId]/matches/route.test.ts` | 12 existing cases that mock `teamScheduleForLeague`; their mocks must be retargeted to the new helper in Task 2.0 or they will stop testing the real path. |
| `components/teams-client.test.tsx` | Gains a case asserting no `sm:`/`lg:grid-cols-*` classes survive the single-column change (Task 4.0). |
| `components/entity-card.tsx` | Rewritten to a header + stacked `MatchCard` / `TennisMatchCard` layout (Task 4.0). |
| `components/entity-card.test.tsx` | Existing card tests; rewritten for the new markup, card selection, and preserved empty states. |
| `components/teams-client.tsx` | Grid at line 101 collapses to a single column (Task 4.0). |
| `components/match-card.tsx` | Reused unchanged, except for the competition-name fallback in the footer when `round` is absent (Task 4.0). |
| `components/match-card.test.tsx` | Gains a case for the competition-name footer fallback. |
| `lib/espn/__fixtures__/liverpool-eng1-empty-schedule.json` | **New.** Recorded empty current-season payload driving the fallback test. |
| `lib/espn/__fixtures__/liverpool-eng1-schedule-2025.json` | **New.** Recorded populated previous-season payload (38 events, trimmed). |
| `lib/espn/__fixtures__/liverpool-friendly-schedule.json` | **New.** Recorded `club.friendly` payload (3 events) driving the multi-competition merge test. |
| `README.md` | "Operations → Release notes" gains an entry for the coverage change (Task 5.0). |
| `docs/specs/13-spec-teams-match-coverage-and-cards/13-proofs/` | **New.** Per-task proof artifact files, matching the Spec 12 `12-proofs/` layout. |

### Notes

- Tests are colocated with the code they test (`foo.ts` next to `foo.test.ts`), per `AGENTS.md`.
- Run a single file with `pnpm test lib/teams/schedule.test.ts`; CI runs `pnpm test:ci` (`vitest run`).
- ESPN calls in tests must be hermetic: inject via `ClientOptions.fetchFn` and the
  `routedFetch(routes)` URL-substring router already used in `lib/espn/client.test.ts`.
  Do not monkey-patch global `fetch` and do not hit the network — CI has no
  network-dependent secrets.
- Recorded fixtures should be trimmed to the fields `parseEvent` actually reads,
  keeping diffs reviewable. They contain public match data only.
- Full gate set, in CI order: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test:ci`, `pnpm build`.
- Conventional Commits, with the SDD task and spec referenced in the body, e.g.
  `Related to T1.3 in Spec 13-spec-teams-match-coverage-and-cards`.

## Tasks

### [x] 1.0 Season-aware team schedule fetching

Fix the root cause of the empty Teams screen: `teamScheduleForLeague` sends no
`season` parameter, so during a season rollover ESPN resolves to an unpublished
season and returns zero events. Implement an explicit season parameter plus a
single bounded fallback to the previous season, inside the one shared helper both
Teams routes already call. Covers Spec Unit 1.

#### 1.0 Proof Artifact(s)

- Test: `pnpm test:ci` — new cases in `lib/espn/client.test.ts` named
  `"falls back to the previous season when the current season is empty"` and
  `"issues no fallback request when the current season is populated"` pass,
  demonstrating the retry fires only on an empty result and that a populated
  season short-circuits it.
- Test: `pnpm test:ci` — a case asserting `teamScheduleForLeague` resolves to
  `[]` (does not throw) when both seasons are empty demonstrates the graceful
  degradation path from the spec is preserved.
- Test: `pnpm test:ci` — a case asserting the fallback issues exactly one extra
  request (request-URL count === 2) demonstrates the "at most one retry" bound.
- CLI: recorded output of
  `curl -s "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule" | jq '.events | length'`
  (0) beside
  `curl -s ".../schedule?season=2025" | jq '.events | length'` (38),
  saved to `13-proofs/13-task-01-proofs.md`, demonstrates the upstream behaviour
  the fallback is written against.
- CLI: `pnpm lint && pnpm typecheck && pnpm test:ci` all exit 0, demonstrating
  the repo quality gates hold.

#### 1.0 Tasks

- [x] 1.1 Extend `buildTeamScheduleUrl` in `lib/espn/client.ts` to accept an
      optional `season?: number` and append `?season=<year>` when provided.
      Keep the existing no-season signature working so current callers and the
      existing URL-builder test still compile.
- [x] 1.2 Add an exported `currentEspnSeasonYear(now = new Date()): number`
      helper returning the current calendar year. Document in a comment that
      ESPN's soccer season year is the season's *starting* year
      (`season=2025` → the 2025-26 campaign) and that per-sport calendar
      differences are handled by the empty-result fallback, not by encoding
      calendars — per Spec Technical Considerations.
- [x] 1.3 Rework `teamScheduleForLeague` to: request the current season
      explicitly; if the parsed result is empty, issue exactly one retry at
      `currentEspnSeasonYear() - 1`; return the first non-empty result, or `[]`
      when both are empty. Never throw on an empty result.
- [x] 1.4 Give `teamScheduleForLeague` an optional `season` override in its
      options so callers (and Task 2.0's fan-out) can pin a season, and so tests
      can assert behaviour without depending on the wall clock.
- [x] 1.5 Record two fixtures: `lib/espn/__fixtures__/liverpool-eng1-empty-schedule.json`
      (the live empty current-season payload) and
      `lib/espn/__fixtures__/liverpool-eng1-schedule-2025.json` (the populated
      previous-season payload, trimmed to ~4 events plus the `season` block).
- [x] 1.6 Add the four test cases from the proof artifacts to
      `lib/espn/client.test.ts`, using `routedFetch` keyed on the `season=`
      substring, and a request-counting `fetchFn` wrapper for the
      "exactly one retry" assertion.
- [x] 1.7 Capture the `curl` before/after transcript into
      `13-proofs/13-task-01-proofs.md`.
- [x] 1.8 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`
      and commit as `fix(teams): fall back to previous ESPN season when current is empty`.
- [x] 1.9 **Added during implementation, not in the original plan.** Fix
      `parseScore` to handle the object-shaped `score` the team-schedule
      endpoint returns (`{ value, displayValue }`) alongside the scoreboard's
      plain string. Found while recording fixtures; without it every completed
      match from a team schedule loses its score, which would have shipped the
      redesigned cards with no scores in them. See `13-task-01-proofs.md`.

### [ ] 2.0 Multi-competition coverage for team schedules

Add a curated companion-league map so a followed team's matches are gathered from
cups, continental competitions, and friendlies — not just their primary domestic
league. Register `soccer/club.friendly` as a companion-only league, fan out
concurrently with independent per-league caching, and merge with dedupe by match
id. Covers Spec Unit 2 except the latency measurement (Task 5.0). Depends on 1.0.

> **Home feed must not change.** `leagueKeysForSport` feeds the Home aggregator's
> fan-out ([lib/home/aggregator.ts:197](lib/home/aggregator.ts:197)). Adding
> `club.friendly` to `SUPPORTED_LEAGUES` would put friendlies in the Home feed
> and add a league × 5 dates to `/api/home`, violating Spec Non-Goal #8. It goes
> in a separate companion-only list instead.

> **Scope note:** the shared helper is also wired into
> `app/api/teams/[favoriteId]/matches/route.ts` so the detail screen's coverage
> matches the list's. Spec Non-Goal #1 was amended to cover presentation only.

#### 2.0 Proof Artifact(s)

- Test: `pnpm test:ci` — new cases in `lib/espn/leagues.test.ts` assert
  `soccer/club.friendly` resolves via `findSupportedLeague` and that
  `companionLeagueKeys("soccer/eng.1")` returns the six expected keys while
  `companionLeagueKeys("football/nfl")` returns `[]`, demonstrating the
  single-league sports are unchanged.
- Test: `pnpm test:ci` — a case asserting `leagueKeysForSport("Soccer")` does
  **not** include `soccer/club.friendly` demonstrates the Home aggregator's
  fan-out is unchanged (Spec Non-Goal #8).
- Test: `pnpm test:ci` — a case asserting the `unstable_cache` key array passed
  for a schedule lookup contains both the league key and the resolved season,
  and that two different seasons produce two distinct key arrays, demonstrates
  a fallback-season result cannot be served once the new season publishes
  fixtures (Spec Unit 1 FR6, Unit 2 FR4). Uses the existing `next/cache` mock in
  `app/api/teams/route.test.ts` — the real Next.js cache is not invoked.
- Test: `pnpm test:ci` — a case in
  `app/api/teams/[favoriteId]/matches/route.test.ts` asserting a friendly from a
  companion league appears in that route's `recent` array demonstrates the
  detail screen has coverage parity with the list.
- Test: `pnpm test:ci` — a merge test in `lib/teams/schedule.test.ts` using
  multi-league recorded fixtures asserts duplicate match ids collapse to one
  entry and that the selected last/next pair is the chronologically correct one
  across competitions, demonstrating cross-competition selection.
- Test: `pnpm test:ci` — a case asserting a friendly dated after the last league
  fixture is selected as the most recent match demonstrates the spec's
  "no preference for competitive fixtures" rule (Spec Unit 2, Q6 answer A).
- Test: `pnpm test:ci` — a partial-failure case where one companion league's
  fetch rejects asserts the remaining competitions' matches are still returned
  and the error string is recorded, demonstrating graceful degradation.
- Test: `pnpm test:ci` — a case where a companion league returns zero events
  asserts `source.ok` stays `true`, demonstrating that "team not in this
  competition" is not treated as an error.
- Test: `pnpm test:ci` — a case asserting all league requests are issued
  concurrently (all `fetchFn` calls observed before the first resolves)
  demonstrates the fan-out is parallel, which is the premise of the latency
  budget verified in Task 5.0.
- Diff: the added `COMPANION_LEAGUE_KEYS` map in `lib/espn/leagues.ts`,
  reproduced in `13-proofs/13-task-02-proofs.md`, demonstrates the per-team
  request count is knowable by inspection (Spec Technical Considerations).

#### 2.0 Tasks

- [ ] 2.1 Add a `COMPANION_ONLY_LEAGUES: readonly SupportedLeague[]` list to
      `lib/espn/leagues.ts` holding
      `{ leagueKey: "soccer/club.friendly", sport: "Soccer", displayName: "Club Friendly" }`.
      Make `findSupportedLeague` search `SUPPORTED_LEAGUES` **then**
      `COMPANION_ONLY_LEAGUES`, so friendlies resolve a display name. Leave
      `leagueKeysForSport` reading `SUPPORTED_LEAGUES` only. Document in a
      comment that this split exists because `leagueKeysForSport` drives the
      Home aggregator's fan-out at `lib/home/aggregator.ts:197`, and Home must
      not gain friendly fixtures (Spec Non-Goal #8).
- [ ] 2.2 Add `COMPANION_LEAGUE_KEYS: Record<string, readonly string[]>` and a
      `companionLeagueKeys(primaryLeagueKey: string): string[]` helper. Map
      `soccer/eng.1` → `club.friendly`, `eng.fa`, `eng.league_cup`,
      `uefa.champions`, `uefa.europa`, `uefa.europa.conf`. Give the other big-5
      soccer leagues their applicable companions (friendlies + the three UEFA
      competitions; no domestic cups are registered for them). Return `[]` for
      any key with no entry.
- [ ] 2.3 Add `lib/espn/leagues.test.ts` cases for `club.friendly` resolution via
      `findSupportedLeague`, for `companionLeagueKeys` on a soccer league and on
      `football/nfl`, and for `leagueKeysForSport("Soccer")` **excluding**
      `soccer/club.friendly` (the Non-Goal #8 guard).
- [ ] 2.4 Add `teamScheduleAcrossCompetitions(primaryLeagueKey, teamId, opts)` to
      `lib/teams/schedule.ts`. It resolves the companion list, issues all
      schedule requests with `Promise.allSettled`, merges the fulfilled results,
      dedupes by `Match.id`, and returns `{ matches, errors }`. A rejected
      request contributes its message to `errors`; a fulfilled-but-empty result
      contributes nothing.
- [ ] 2.5 Record `lib/espn/__fixtures__/liverpool-friendly-schedule.json` from
      the live `soccer/club.friendly/teams/364/schedule` response, trimmed to the
      3 events.
- [ ] 2.6 Create `lib/teams/schedule.test.ts` with the merge, dedupe,
      friendly-selection, partial-failure, empty-companion, and concurrency cases
      from the proof artifacts.
- [ ] 2.7 Wire `app/api/teams/route.ts` to call
      `teamScheduleAcrossCompetitions` instead of `teamScheduleForLeague`,
      pushing the returned `errors` into the route's existing `errors` array.
      Keep the per-league `unstable_cache` wrapper with `revalidate: 300` and
      include the league key **and season** in the cache key, per Spec
      Technical Considerations.
- [ ] 2.8 Wire `app/api/teams/[favoriteId]/matches/route.ts` to the same helper
      (see the scope note above), keeping `splitAndCapSchedule` for the 10-per-side cap.
- [ ] 2.9 Retarget the mocks in
      `app/api/teams/[favoriteId]/matches/route.test.ts`. All 12 existing cases
      mock `teamScheduleForLeague` from `@/lib/espn/client`; after 2.8 that
      export is no longer on the route's call path, so the mocks must move to
      `teamScheduleAcrossCompetitions` from `@/lib/teams/schedule`. Verify each
      case still fails when the route is deliberately broken — a suite that
      passes against a mock nothing calls is worse than no suite.
- [ ] 2.10 Add a case to that suite asserting a friendly returned by a companion
      league appears in the route's `recent` array, proving coverage parity
      between the two Teams screens.
- [ ] 2.11 Update `app/api/teams/route.test.ts` mocks for the new helper so the
      existing catalog-miss and fetch-throws cases still assert the same
      envelope behaviour.
- [ ] 2.12 Add the cache-key composition test: assert the key array passed to the
      mocked `unstable_cache` contains the league key and the resolved season,
      and that two seasons yield distinct keys.
- [ ] 2.13 Capture the `COMPANION_LEAGUE_KEYS` diff into
      `13-proofs/13-task-02-proofs.md`, and run the full gate set. Commit as
      `feat(teams): include cup, continental, and friendly fixtures in team schedules`.

### [ ] 3.0 Full-`Match` contract for `GET /api/teams`

Change `TeamEntity.lastMatch` / `nextMatch` from the reduced `EntityMatch`
summary to full `Match` objects, so the Teams list can render the same cards Home
does. Drop `extractEntityMatches`, switch the player path from `athleteSchedule`
to `athleteMatchHistory` (already returns full `Match` objects), and remove
`EntityMatch` if nothing else references it. This is the API precondition for
4.0. Depends on 2.0.

#### 3.0 Proof Artifact(s)

- Test: `pnpm test:ci` — updated `app/api/teams/route.test.ts` asserts the
  envelope's `lastMatch` carries `homeTeamName`, `awayTeamName`,
  `homeTeamLogo`, `homeScore`, `awayScore`, and `leagueName`, demonstrating the
  card-ready shape.
- Test: `pnpm test:ci` — a player-favorite case asserts the response is built
  from `athleteMatchHistory` and returns full `Match` objects, demonstrating
  parity between the team and player paths.
- Test: `pnpm test:ci` — a case asserting a player favorite with no ESPN data
  still returns `lastMatch: null, nextMatch: null` with `source.ok` unchanged
  demonstrates the graceful player fallback survived the swap.
- Test: `pnpm test:ci` — the existing 401-unauthenticated case and the
  `Server-Timing` header case still pass, demonstrating the auth gate and
  instrumentation survived the refactor (Spec Security Considerations).
- CLI: `grep -rn "EntityMatch" app components lib` returns no matches (or only
  the intentional remaining references, listed with justification), captured in
  `13-proofs/13-task-03-proofs.md`, demonstrating the dead type was removed
  rather than left orphaned.
- CLI: `pnpm typecheck` exits 0, demonstrating every consumer of the changed
  contract was updated.

#### 3.0 Tasks

- [ ] 3.1 Change `TeamEntity.lastMatch` and `nextMatch` in `lib/teams/types.ts`
      to `Match | null`, and update the interface's doc comment to say the
      Teams list now renders Home-style cards.
- [ ] 3.2 Add a `selectLastAndNext(matches: readonly Match[]): { lastMatch: Match | null;
      nextMatch: Match | null }` helper to `lib/teams/schedule.ts`, reusing the
      same `kickoffUtc ?? dateUtc` sort key that `splitAndCapSchedule` uses so
      the two selectors cannot drift.
- [ ] 3.3 Delete `extractEntityMatches` from `app/api/teams/route.ts` and its
      tests, replacing the call with `selectLastAndNext`.
- [ ] 3.4 Switch the player branch in `app/api/teams/route.ts` from
      `athleteSchedule` to `athleteMatchHistory`, taking `recent[0]` and
      `upcoming[0]`. Preserve the existing behaviour that a graceful null result
      does **not** flip `source.ok` (only a thrown error does).
- [ ] 3.5 Run `grep -rn "EntityMatch" app components lib` and remove the type
      from `lib/teams/types.ts` if nothing outside the deleted code references
      it. If `athleteSchedule` is now unused across the repo, remove it too
      rather than leaving a dead export.
- [ ] 3.6 Update `app/api/teams/route.test.ts`: rewrite the team and player
      assertions against the full-`Match` shape, add the player-no-data case,
      and confirm the 401 and `Server-Timing` cases are untouched.
- [ ] 3.7 Capture the `grep` output into `13-proofs/13-task-03-proofs.md`, run
      the full gate set, and commit as
      `refactor(teams): return full Match objects from /api/teams`.

### [ ] 4.0 Teams list score-card redesign

Rewrite `EntityCard` to render a crest+name header followed by stacked
last-match and next-match cards, reusing `MatchCard` / `TennisMatchCard`, and
collapse the Teams grid to a single column. Preserve the existing empty states
and the link into `/teams/[favoriteId]`. Covers Spec Unit 3. Depends on 3.0.

#### 4.0 Proof Artifact(s)

- Screenshot: `/teams` at 375px viewport width showing at least three followed
  entities as stacked score cards, saved to
  `13-proofs/13-task-04-proofs.md`, demonstrates the redesign end to end and
  that the layout is single-column on mobile.
- Screenshot: the same `/teams` view showing a Liverpool card whose most-recent
  match is a preseason friendly with the competition name visible in the card
  footer demonstrates that non-league fixtures surface and are labelled
  (Spec Unit 2 + Unit 3 together — the headline user-visible fix).
- Test: `pnpm test:ci` — updated `components/entity-card.test.tsx` asserts a
  non-tennis entity renders the `match-card` testid and a tennis entity renders
  the tennis card, demonstrating correct per-sport card selection.
- Test: `pnpm test:ci` — a case with `lastMatch: null, nextMatch: null` asserts
  the "Match data unavailable" copy still renders, and a case with one side null
  asserts the per-side empty copy renders, demonstrating the empty states
  survived the redesign.
- Test: `pnpm test:ci` — a case asserting the entity header is a link to
  `/teams/[favoriteId]` with a `min-h-11` class demonstrates navigation and the
  ≥44px touch-target standard are preserved.
- Screenshot: `/teams` at ≥1280px viewport width, saved to the same proof file,
  demonstrates the layout is single-column at *all* widths — a 375px screenshot
  alone would also pass for a grid that is merely stacked on mobile
  (Spec Unit 3 FR3).
- Test: `pnpm test:ci` — a `components/teams-client.test.tsx` case asserting the
  entity container carries no `sm:grid-cols-*` or `lg:grid-cols-*` class
  demonstrates the multi-column grid was removed rather than overridden.
- Test: `pnpm test:ci` — a `components/match-card.test.tsx` case asserting the
  footer renders `leagueName` when `round` is absent demonstrates the
  competition-labelling requirement without regressing Home, where `round` is
  usually present.

#### 4.0 Tasks

- [ ] 4.1 Add the competition fallback to `components/match-card.tsx`: when
      `round` is absent, render `leagueName` in the same footer slot. Confirm
      `showFooter` accounts for the new condition so a friendly with no `round`
      still renders its footer.
- [ ] 4.2 Add the `match-card.test.tsx` case for the `leagueName` fallback and a
      case confirming `round` still wins when both are present.
- [ ] 4.3 Rewrite `components/entity-card.tsx`: a `<Link>`ed header
      (crest + display name, `min-h-11`, existing focus-visible ring and
      `aria-label`) followed by the last-match card then the next-match card.
      Delete `MatchRow`, `ResultBadge`, `formatShortDate`, and `formatKickoff` —
      `MatchCard` covers all of it.
- [ ] 4.4 Add the tennis/non-tennis card selection, mirroring
      `EntityMatchCard` in `components/entity-matches-client.tsx:12`. Extract
      that helper into a shared module and import it from both places rather
      than duplicating the ternary.
- [ ] 4.5 Preserve the empty states: `Match data unavailable` when both sides
      are null; `No recent match` / `No upcoming match` when one side is.
      Label each card slot ("Last" / "Next") so a lone card is unambiguous.
- [ ] 4.6 Change the grid in `components/teams-client.tsx:101` from
      `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` to a single-column
      `flex flex-col gap-4`, matching the detail screen's list rhythm.
- [ ] 4.7 Add the `components/teams-client.test.tsx` case asserting no
      `sm:grid-cols-*` / `lg:grid-cols-*` class remains on the container.
- [ ] 4.8 Rewrite `components/entity-card.test.tsx` against the new markup,
      covering all five proof-artifact test cases. The existing
      `renders as a link to the entity's detail route with an accessible label`
      case should survive largely intact.
- [ ] 4.9 Run the app, sign in with a Liverpool favorite, and capture three
      screenshots into `13-proofs/13-task-04-proofs.md`: the entity list at
      375px, the Liverpool friendly card at 375px, and the list at ≥1280px.
      Redact the account menu email before committing (Spec Security
      Considerations).
- [ ] 4.10 Run the full gate set and commit as
      `feat(teams): render Teams list entities as Home-style match cards`.

### [ ] 5.0 Latency verification and release documentation

Measure `/api/teams` before and after the added fan-out against the Spec 12
methodology, confirm the stated budget (warm median ≤ 100 ms, cold ≤ 1 200 ms),
and record the outcome. Add a README release note for the coverage change.
Depends on 4.0.

#### 5.0 Proof Artifact(s)

- Measurement: a before/after table in
  `13-proofs/13-task-05-proofs.md` reporting `/api/teams` cold and warm-median
  `Server-Timing` values, captured with the same method as
  `docs/specs/12-spec-performance-optimization/12-baseline-performance.md`,
  demonstrates whether the budget in the spec holds. Must state the entity count
  and the measurement command used.
- Measurement: the same table for `/api/teams/[id]/matches`, demonstrating the
  detail route did not regress from its Spec 12 ≤ 50 ms warm gate as a
  side effect of the shared `teamScheduleForLeague` change.
- Measurement: `/api/home` cold and warm figures unchanged from the Spec 12
  baseline, demonstrating the companion-only league registration left the Home
  aggregator's fan-out untouched (Spec Non-Goal #8). Pairs with the
  `leagueKeysForSport` unit test from Task 2.3 — one proves the set, the other
  proves the cost.
- Diff: the README "Release notes" entry naming the season-fallback and
  competition-coverage change demonstrates the operational change is documented
  where prior spec-level behaviour changes were recorded.
- CLI: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci &&
  pnpm build` all exit 0, demonstrating the full CI gate set from
  `.github/workflows/ci.yml` passes before handoff.

#### 5.0 Tasks

- [ ] 5.1 Re-read the measurement method in
      `docs/specs/12-spec-performance-optimization/12-baseline-performance.md`
      and reproduce it exactly, so the numbers are comparable rather than
      merely similar. Record the favorites profile (entity count) used.
- [ ] 5.2 Measure `/api/teams` cold and warm-median against the pre-change
      commit (`git stash` or a checkout of the Task 0 baseline) to establish the
      "before" column with the same profile.
- [ ] 5.3 Measure `/api/teams` cold and warm-median on the implemented branch.
      Compare against the spec budget: warm median ≤ 100 ms, cold ≤ 1 200 ms.
- [ ] 5.4 Measure `/api/teams/[id]/matches` and `/api/home`. The `/api/home`
      figures should match the Spec 12 baseline; a change there means
      `club.friendly` leaked into `leagueKeysForSport` and Task 2.1 needs
      revisiting.
- [ ] 5.5 Write `13-proofs/13-task-05-proofs.md` with the before/after tables,
      the commands used, and an explicit PASS/FAIL against each budget. If a
      budget fails, state it plainly and record the narrowing options from Spec
      Open Question 3 rather than silently rewriting the budget.
- [ ] 5.6 Add a README "Operations → Release notes" entry dated to the merge
      date, naming the season fallback and the competition coverage, and noting
      that no cache-prefix bump is needed because the new cache keys include the
      season and league key.
- [ ] 5.7 Run the full CI gate set including `pnpm build`, and commit as
      `docs(teams): record match-coverage performance evidence and release note`.
