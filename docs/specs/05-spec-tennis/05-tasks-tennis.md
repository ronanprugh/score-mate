# 05-tasks-tennis.md

Implementation task list for [05-spec-tennis.md](./05-spec-tennis.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/sports/types.ts` | MODIFY. Add `"Tennis"` to the `Sport` union and to `SUPPORTED_SPORTS`. |
| `lib/espn/client.ts` | MODIFY. Add `tennis: "Tennis"` to `SPORT_FROM_SEGMENT` (so `sportFromLeagueKey("tennis/atp/wimbledon")` resolves) and update the deprecation note that previously declared tennis out-of-scope. |
| `lib/espn/client.test.ts` | MODIFY. Extend the `sportFromLeagueKey` table to include `tennis/atp/wimbledon` and `tennis/slam/wimbledon`. |
| `lib/espn/tennis.ts` | NEW. Defines `MARQUEE_TENNIS_TOURNAMENTS` (23 entries), the `MarqueeTournament` shape, and `tennisScoreboard(tournamentId, date)`. |
| `lib/espn/tennis.test.ts` | NEW. Registry shape/count assertions, id-format regex, Grand Slam id presence, scoreboard parsing happy path + empty-body path. |
| `lib/favorites/validators.test.ts` | MODIFY. Add positive case for `{ type: "event", sport: "Tennis", externalId: "tennis/slam/wimbledon" }`; keep rejected-sports set as-is. |
| `lib/sport-allowlist.test.ts` | MODIFY. Loop over `SUPPORTED_SPORTS` skips Tennis (no allowlist entry expected per Q8 (A)); add a negative case that confirms no Tennis allowlist key exists. |
| `scripts/verify-tennis-endpoints.ts` | NEW. Operator script: HEAD-checks each of the 23 marquee scoreboard endpoints and writes results to `docs/specs/05-spec-tennis/05-proofs/05-endpoint-verify.txt`. |
| `lib/home/tennis-aggregator.ts` | NEW. `getActiveTennisTournaments(today, fetcher)` iterates the marquee registry, calls `tennisScoreboard`, and returns the `ActiveTournament[]` list with `live/upcoming/done` counts, `currentRound`, dates, and raw `matches`. |
| `lib/home/tennis-aggregator.test.ts` | NEW. Asserts count derivation, empty-tournament filtering, `currentRound` parsing. |
| `lib/home/cache.ts` | MODIFY. Bump `CACHE_KEY_PREFIX` from `"v6-espn-baseball"` to `"v7-espn-tennis"`; add `cachedActiveTennisTournaments(today)` wrapping `unstable_cache` with a 3600s revalidate; extend `Fetchers` with an `activeTennisTournaments` entry; update `makeCachedFetchers` accordingly. |
| `lib/home/cache.test.ts` | MODIFY. Assert new `CACHE_KEY_PREFIX` value; cover the cache key shape for the tennis cache. |
| `lib/home/aggregator.ts` | MODIFY. Extend `Fetchers`, `HomeEnvelope` (add `activeTennisTournaments: ActiveTournament[]`), and `aggregateMatchesForUser`/`buildHomeEnvelope` to thread the tennis-aggregator result through. Add the earliest-live-or-upcoming sort-key helper. |
| `lib/home/aggregator.test.ts` | MODIFY. Cover the new field in the envelope; assert the sort key produces a stable ordering when tournament cards are mixed with match cards. |
| `components/tournament-card.tsx` | NEW. `"use client"` component. Collapsed view (name, date range, round, counts). Expanded view renders `MatchCard` per match. Chevron rotates. Local React state for open/closed. |
| `components/tournament-card.test.tsx` | NEW. Collapsed rendering, expand toggle, expanded children are `MatchCard`s, touch-target check. |
| `components/match-card.tsx` | MODIFY. Render player-vs-player when both team logos are absent: skip the logo placeholder slot and bypass `splitTeamName` (use full `displayName` directly). |
| `components/match-card.test.tsx` | MODIFY. Add a player-vs-player fixture; assert no logo placeholder div and no prefix/mascot split. |
| `components/home-client.tsx` | MODIFY. Read `activeTennisTournaments` from the home envelope and render `<TournamentCard>` for each, mixed into today's match list using the sort-key helper. |
| `components/home-client.test.tsx` | MODIFY. Confirm tournament cards appear when present and are absent when the array is empty. |
| `app/(app)/home/page.tsx` | MODIFY ONLY IF NEEDED. Pass the new envelope field through to `home-client`. (No new props if `HomeEnvelope` already flows through.) |
| `lib/espn/catalog.json` | MODIFY. Add 23 Tennis tournament entries to `leagues` (year-less ids); no team entries are added (no players in v1). |
| `lib/espn/catalog.test.ts` | MODIFY. Bump league count from 21 → 44; add a Tennis catalog assertion (`searchCatalogLeagues("wimbledon")` returns the entry); assert sport set now includes `"Tennis"`. |
| `app/api/favorites/search/route.ts` | MODIFY. When a `league`-shaped Tennis catalog result is selected, translate to a `type: "event"` favorite POST payload with the year-less `externalId`. |
| `app/api/favorites/search/route.test.ts` | MODIFY (or NEW if it doesn't exist). Cover the translation. |
| `README.md` | MODIFY. Append a one-line entry under **Operations → Release notes** referencing Spec 05 and the `v7-espn-tennis` prefix bump. |
| `docs/specs/05-spec-tennis/05-proofs/` | NEW. Evidence bundle directory (endpoint verification, CI transcript, screenshots, catalog counts, touched-files list, proof index README). |

### Notes

- Tests are colocated next to their source files per `AGENTS.md`.
- Run `pnpm test:ci` locally; CI runs `lint → format:check → typecheck → test:ci → build`.
- All commits use Conventional Commits with `Related to T#.# in Spec 05-spec-tennis` in the body.
- No new runtime dependencies. No DB migration (`favorites.sport` is free text; `type: "event"` already exists).
- Per Success Metric §6, no edits outside the file set above (specifically: no edits to other route handlers, auth, DB schema, bottom-nav).

## Tasks

### [x] 1.0 Tennis sport scaffolding + marquee tournament registry

Maps Spec Unit 1. Teach the type system and the favorites validator that Tennis exists, register the 23 marquee tournaments (4 Slams + 9 ATP 1000 + 10 WTA 1000), and ship the per-tournament ESPN scoreboard client. No homepage or UI changes in this task — pure code + tests. Commits with body `Related to T1.0 in Spec 05-spec-tennis`.

#### 1.0 Proof Artifact(s)

- Test: `pnpm test:ci` passes. New tests in `lib/espn/tennis.test.ts` assert (a) `MARQUEE_TENNIS_TOURNAMENTS.length === 23`, (b) every entry's id matches `/^tennis\/(atp|wta|slam)\/[a-z0-9-]+$/`, (c) the four Grand Slams are present by id.
- Test: `lib/espn/client.test.ts` covers `sportFromLeagueKey("tennis/atp/wimbledon") === "Tennis"` and `sportFromLeagueKey("tennis/slam/wimbledon") === "Tennis"`.
- Test: `lib/favorites/validators.test.ts` accepts `{ type: "event", sport: "Tennis", externalId: "tennis/slam/wimbledon" }` and continues to reject unsupported sports.
- Test: `lib/sport-allowlist.test.ts` asserts the loop over `SUPPORTED_SPORTS` skips Tennis cleanly (no allowlist entry expected) and the existing positive cases for the other sports still pass.
- CLI: `pnpm typecheck` clean — confirms the new `Sport` value propagates with no `any` escape hatches.
- CLI: a one-shot `pnpm tsx` script captures HTTP status from each of the 23 marquee scoreboard endpoints into `docs/specs/05-spec-tennis/05-proofs/05-endpoint-verify.txt` (every endpoint returns 200, even if body is empty).

#### 1.0 Tasks

- [x] 1.1 Add `"Tennis"` to the `Sport` union and to the `SUPPORTED_SPORTS` readonly array in `lib/sports/types.ts`. Place it next to the existing four-sport set (preserve alphabetical order if the array is alphabetical, otherwise append).
- [x] 1.2 Add the `tennis: "Tennis"` mapping to `SPORT_FROM_SEGMENT` in `lib/espn/client.ts`. Update the doc-comment that lists supported segments. Remove the stale comment at `lib/espn/client.ts:39` that says tennis is out-of-scope (now superseded by this spec).
- [x] 1.3 Extend the `sportFromLeagueKey` `it.each` table in `lib/espn/client.test.ts` to include `["tennis/atp/wimbledon", "Tennis"]`, `["tennis/wta/wimbledon", "Tennis"]`, and `["tennis/slam/wimbledon", "Tennis"]`.
- [x] 1.4 Create `lib/espn/tennis.ts`. Define the exported `MarqueeTournament` type: `{ id: string; tour: "ATP" | "WTA" | "Slam"; displayName: string; scoreboardUrlTemplate: string }`. Define and export `MARQUEE_TENNIS_TOURNAMENTS` as a readonly array. Populate the four Grand Slam ids (`tennis/slam/australian-open`, `tennis/slam/roland-garros`, `tennis/slam/wimbledon`, `tennis/slam/us-open`) and 9 ATP 1000 + 10 WTA 1000 entries (slugs may be left as `// TODO(05): verify slug` for those not yet confirmed against ESPN — T1.10 verifies them). Add a doc-comment header listing the ATP/WTA calendar source URLs.
- [x] 1.5 In the same file, add `export async function tennisScoreboard(tournamentId: string, date: string, opts?: ClientOptions): Promise<Match[]>`. Implementation mirrors `scoreboardForLeague`: build the URL from the registry entry's template + `dates=YYYYMMDD` query, `fetchJson<RawScoreboardResponse>`, and reuse `parseEvent` to produce `Match[]`. If the response body has no `events`, return `[]`.
- [x] 1.6 Create `lib/espn/tennis.test.ts` with: (a) `MARQUEE_TENNIS_TOURNAMENTS.length === 23`; (b) every entry's `id` matches `/^tennis\/(atp|wta|slam)\/[a-z0-9-]+$/`; (c) the four Grand Slam ids are present; (d) a fixture-driven `tennisScoreboard` parse test using a sample ESPN tennis scoreboard JSON body; (e) empty `events` → returns `[]`.
- [x] 1.7 Update `lib/favorites/validators.test.ts`: add a positive case asserting `createFavoriteSchema.safeParse({ type: "event", externalId: "tennis/slam/wimbledon", displayName: "Wimbledon", sport: "Tennis" })` succeeds. Keep the "rejects unsupported sports" test green.
- [x] 1.8 Update `lib/sport-allowlist.test.ts`: change the "every supported sport has ≥1 entry" iteration to exclude Tennis (or assert Tennis IS the only key with zero entries — implementer's call); add a positive assertion that `SPORT_ALLOWLIST` does NOT have a `Tennis` key, with a comment linking to Q8 (A).
- [x] 1.9 Create `scripts/verify-tennis-endpoints.ts`: iterate `MARQUEE_TENNIS_TOURNAMENTS`, perform a `fetch` GET (today's date) against each scoreboard URL, capture status code + ms latency + body byte length, and print one line per tournament to stdout. Designed to be run via `pnpm tsx scripts/verify-tennis-endpoints.ts > docs/specs/05-spec-tennis/05-proofs/05-endpoint-verify.txt`.
- [x] 1.10 Run `pnpm tsx scripts/verify-tennis-endpoints.ts`; resolve every `TODO(05)` slug using the script output (status 200 confirms the slug is valid). Commit the corrected slugs.
- [x] 1.11 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`. Commit using `feat(tennis): register Tennis sport, marquee tournament registry, scoreboard client` with body `Related to T1.0 in Spec 05-spec-tennis`.

### [x] 2.0 Active-tournament aggregator + cache layer + cache prefix bump

Maps Spec Unit 2 (data half). Add `getActiveTennisTournaments(today)`, wrap it in a 1-hour cache layer, bump `CACHE_KEY_PREFIX` to `v7-espn-tennis`, and surface the result in the homepage aggregator's output under a new `activeTennisTournaments` field. Depends on T1.0. No UI yet — verified by aggregator unit tests and a fixture-driven integration test. Commits with body `Related to T2.0 in Spec 05-spec-tennis`.

#### 2.0 Proof Artifact(s)

- Test: `lib/home/tennis-aggregator.test.ts` covers (a) only tournaments whose ESPN call returns ≥1 match for `today` appear in the result; (b) `liveCount`, `upcomingCount`, `doneCount` are computed correctly from a fixture mixing all three statuses; (c) `currentRound` is parsed from the first match's `round`.
- Test: `lib/home/cache.test.ts` asserts `CACHE_KEY_PREFIX === "v7-espn-tennis"`.
- Test: `lib/home/cache.test.ts` asserts the new `cachedActiveTennisTournaments` cache key includes the prefix, the literal `"tennis-active"`, and the date.
- Test: integration test in `lib/home/aggregator.test.ts` (or new `aggregator-tennis.test.ts`) confirms `activeTennisTournaments` is present on the aggregator output and contains only tournaments with non-empty matches.
- CLI: `pnpm typecheck` clean.
- CLI: `pnpm test:ci` all green.

#### 2.0 Tasks

- [x] 2.1 Create `lib/home/tennis-aggregator.ts`. Export the `ActiveTournament` interface: `{ id, displayName, tour, startDate, endDate, currentRound, liveCount, upcomingCount, doneCount, matches: Match[] }`. Export `getActiveTennisTournaments(today: string, fetcher: TennisScoreboardFetcher): Promise<ActiveTournament[]>`. The `TennisScoreboardFetcher` type takes `(tournamentId, date)` and returns `Promise<Match[]>` — defined in this file and re-exported.
- [x] 2.2 Implementation: iterate `MARQUEE_TENNIS_TOURNAMENTS` in parallel via `Promise.allSettled`; drop tournaments whose call rejected OR returned `[]`; for survivors derive `liveCount` = matches with `status === "live"`, `upcomingCount` = `status === "upcoming"`, `doneCount` = `status === "final"`. Derive `currentRound` from the `round` field of the first match (any status). Derive `startDate` and `endDate` from `min`/`max` of `dateUtc` across all returned matches.
- [x] 2.3 Create `lib/home/tennis-aggregator.test.ts`: fixture with 5 tournaments (3 returning matches mixing live/upcoming/final, 2 returning `[]`). Assert only 3 appear; counts match expected; `currentRound` is parsed from the first match.
- [x] 2.4 Bump `CACHE_KEY_PREFIX` in `lib/home/cache.ts` from `"v6-espn-baseball"` to `"v7-espn-tennis"`. Update the doc-comment one-liner that explains the prefix rationale.
- [x] 2.5 Add `cachedActiveTennisTournaments(today: string): Promise<ActiveTournament[]>` to `lib/home/cache.ts`. Wrap `getActiveTennisTournaments` (passing a fetcher that calls `tennisScoreboard`) in `unstable_cache` with key `[CACHE_KEY_PREFIX, "tennis-active", today]` and `{ revalidate: 3600 }`. Export a `TennisActiveFetcher` type.
- [x] 2.6 Extend `Fetchers` in `lib/home/aggregator.ts` with `activeTennisTournaments: (today: string) => Promise<ActiveTournament[]>`. Update `makeCachedFetchers` in `lib/home/cache.ts` to populate it from `cachedActiveTennisTournaments`.
- [x] 2.7 Extend `HomeEnvelope` in `lib/home/aggregator.ts` with `activeTennisTournaments: ActiveTournament[]`. Update `EMPTY_ENVELOPE` to default it to `[]`. Update `buildHomeEnvelope` to accept (or compute) the list and include it in the returned envelope.
- [x] 2.8 Update `aggregateMatchesForUser` to call `fetchers.activeTennisTournaments(dates.today)` in parallel with the existing match fetches; on rejection, log a `source.errors` entry and fall back to `[]`.
- [x] 2.9 Update the prefix assertion in `lib/home/cache.test.ts` to expect `"v7-espn-tennis"` and add a one-line rationale comment referencing this spec. Add a test asserting the new cache key shape includes prefix + `"tennis-active"` + date.
- [x] 2.10 Add tests to `lib/home/aggregator.test.ts`: (a) `aggregateMatchesForUser` populates `activeTennisTournaments` from the fetcher; (b) on fetcher rejection, the envelope still returns successfully with `activeTennisTournaments: []` and a `source.errors` entry; (c) `EMPTY_ENVELOPE` includes the new field.
- [x] 2.11 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`. Commit using `feat(tennis): active-tournament aggregator + 1h cache + v7-espn-tennis prefix bump` with body `Related to T2.0 in Spec 05-spec-tennis`.

### [x] 3.0 TournamentCard component (collapsed + expanded) + MatchCard player-vs-player extension + homepage mixed-feed sort

Maps Spec Unit 2 (UI half) + Spec Unit 3 (expand interaction). Build the `TournamentCard` component with collapsed and expanded states, extend `MatchCard` to render player-vs-player (no logos, full names per Q5 Round 2), wire the homepage to render tournament cards mixed in with match cards, and implement the "earliest live/upcoming kickoff" sort key per Q3 Round 2. Depends on T2.0. Commits with body `Related to T3.0 in Spec 05-spec-tennis`.

#### 3.0 Proof Artifact(s)

- Test: `components/tournament-card.test.tsx` renders a fixture and asserts (a) collapsed state shows `displayName`, formatted date range, `currentRound`, and "N live · M upcoming · K done"; (b) tapping the chevron toggles to expanded; (c) expanded state renders one `<MatchCard>` per match in chronological order; (d) card root meets `min-h-11`.
- Test: `components/match-card.test.tsx` adds a player-vs-player fixture and asserts (a) full names render unchanged (no prefix/mascot split); (b) no logo placeholder div is rendered when both logos are absent; (c) score column behaves the same way it does for team sports.
- Test: `lib/home/aggregator.test.ts` (or sort-helper unit) asserts the sort key places a tournament card at the slot matching its earliest live/upcoming `kickoffUtc`, and that tournaments with no live/upcoming match today sort below all match cards.
- Screenshot: `docs/specs/05-spec-tennis/05-proofs/05-tournament-card.png` — collapsed tournament card on the homepage during an active Slam.
- Screenshot: `docs/specs/05-spec-tennis/05-proofs/05-tournament-card-expanded.png` — same card expanded showing `MatchCard` rows for that day's matches.
- CLI: `pnpm typecheck` clean.

#### 3.0 Tasks

- [x] 3.1 Extend `MatchCard` in `components/match-card.tsx`: introduce a `isPlayerVsPlayer` derived flag set when **both** `homeTeamLogo` and `awayTeamLogo` are absent. When true: skip rendering the logo placeholder div in each `TeamSide`; pass the raw `displayName` to the name block (no `splitTeamName` call). Keep the score column behavior unchanged.
- [x] 3.2 Add a player-vs-player fixture and tests to `components/match-card.test.tsx`: render `<MatchCard match={{ homeTeamName: "Carlos Alcaraz", awayTeamName: "Jannik Sinner", homeTeamLogo: undefined, awayTeamLogo: undefined, status: "live", homeScore: 2, awayScore: 1, ...rest }} />`; assert (a) both full names are present in the DOM verbatim, (b) no element with the placeholder class `bg-zinc-100` exists for the logo slot, (c) the prefix span (`text-xs` mascot prefix) is NOT rendered.
- [x] 3.3 Create `components/tournament-card.tsx` as a `"use client"` component. Props: `{ tournament: ActiveTournament }`. Render the collapsed state: a single article row with `displayName` (left), date range formatted as `"MMM d – MMM d"`, `currentRound` (center), a counts line `"{liveCount} live · {upcomingCount} upcoming · {doneCount} done"` (right), and a chevron button (right-most). Use `min-h-11` + `p-2.5` + `border border-zinc-200 dark:border-zinc-800 rounded-md`. Local React state `isOpen` defaults to `false`.
- [x] 3.4 Add the expanded state to `TournamentCard`: when `isOpen` is `true`, render a flex column below the collapsed row containing one `<MatchCard match={m} />` per match in `tournament.matches`, sorted by `kickoffUtc` ascending. The chevron rotates 180° via a Tailwind `transition-transform` class.
- [x] 3.5 Create `components/tournament-card.test.tsx` covering: (a) collapsed state shows displayName, formatted date range, `currentRound`, and the counts line; (b) chevron click toggles `isOpen`; (c) expanded state renders `data-testid="match-card"` once per match; (d) collapsed-row root meets `min-h-11`; (e) two cards on the page can be expanded independently.
- [x] 3.6 Add a `sortKeyForTournamentCard(t: ActiveTournament): string` helper to `lib/home/aggregator.ts`: returns the minimum `kickoffUtc` across `t.matches.filter(m => m.status === "live" || m.status === "upcoming")`, falling back to `"9999-12-31T23:59:59"` (same fallback string as `sortByKickoff` so tournaments with no live/upcoming match sort below all match cards).
- [x] 3.7 In `components/home-client.tsx`, build a unified `todayItems: Array<{ kind: "match"; m: Match } | { kind: "tournament"; t: ActiveTournament }>` from `envelope.today` and `envelope.activeTennisTournaments`. Sort with a comparator that uses `kickoffUtc` for matches and `sortKeyForTournamentCard` for tournaments. Render each item with either `<MatchCard>` or `<TournamentCard>`.
- [x] 3.8 Update `components/home-client.test.tsx`: (a) when envelope has 2 matches and 1 active tournament with one live match at `T-30m`, the tournament card renders BETWEEN the two matches at the correct slot; (b) when `activeTennisTournaments` is `[]`, no `TournamentCard` is rendered.
- [x] 3.9 If `app/(app)/home/page.tsx` passes individual envelope fields to `home-client` rather than the whole envelope, add the `activeTennisTournaments` field to the props. Otherwise no change required.
- [x] 3.10 Capture two screenshots in `docs/specs/05-spec-tennis/05-proofs/`: `05-tournament-card.png` (collapsed card on the homepage during a Slam, devtools screenshot of the rendered fixture is acceptable if no live Slam is in session) and `05-tournament-card-expanded.png` (same card expanded, showing MatchCard rows). Use the `pnpm dev` server with a fixture user that has a Tennis favorite.
- [x] 3.11 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`. Commit using `feat(tennis): TournamentCard + MatchCard player-vs-player + homepage mixed-feed sort` with body `Related to T3.0 in Spec 05-spec-tennis`.

### [x] 4.0 Tennis tournaments in favorites typeahead + catalog + favorites round-trip

Maps Spec Unit 3 (favorites half). Add the 23 marquee tournaments to `lib/espn/catalog.json` as `league`-typed catalog entries with stable year-less ids, translate a selected catalog entry into a `type: "event"` favorite POST body in the search route handler, and confirm the round-trip (add → list → render → remove). Depends on T1.0 (validator already accepts Tennis events). Commits with body `Related to T4.0 in Spec 05-spec-tennis`.

#### 4.0 Proof Artifact(s)

- Test: `lib/espn/catalog.test.ts` asserts the catalog contains exactly 23 Tennis entries; the four Grand Slams appear by year-less id (`tennis/slam/wimbledon`, etc.); `searchCatalogLeagues("wimbledon")` returns the Wimbledon entry; total league count bumps from 21 to 44.
- Test: `app/api/favorites/search/route.test.ts` (or equivalent integration test) asserts that selecting a Tennis catalog entry produces a POST body with `type: "event"`, `sport: "Tennis"`, and `externalId` matching the year-less id.
- Test: `lib/favorites/validators.test.ts` accepts the year-less id format for `event` favorites with sport `Tennis`.
- Screenshot: `docs/specs/05-spec-tennis/05-proofs/05-search-tennis.png` showing the search results when typing "wimbledon" (Wimbledon row visible with sport `Tennis`).
- Screenshot: `docs/specs/05-spec-tennis/05-proofs/05-favorite-added.png` showing the row's button in "Added" state after a successful POST.

#### 4.0 Tasks

- [x] 4.1 Hand-edit `lib/espn/catalog.json` to add 23 Tennis league entries. Each entry: `{ id: "tennis/{tour}/{slug}", name: <displayName>, sport: "Tennis", leagueKey: "tennis/{tour}/{slug}" }`. Keep the file sorted by sport then `leagueKey` to maintain the script's deterministic ordering invariant. Do NOT add any team entries (players are out of scope).
- [x] 4.2 Update `lib/espn/catalog.test.ts`: bump the league count assertion from 21 to 44; add `"Tennis"` to the sport-set assertion (now `["American Football", "Baseball", "Basketball", "Soccer", "Tennis"]`); add a Wimbledon assertion: `searchCatalogLeagues("wimbledon")` returns at least one entry with `id === "tennis/slam/wimbledon"` and `sport === "Tennis"`.
- [x] 4.3 In `app/api/favorites/search/route.ts`, when a Tennis catalog league entry is included in the response, set its `type` field to `"event"` (not `"league"`) AND its `externalId` to the year-less catalog id. The displayed type label in the typeahead row stays "Tournament" (or "League" if simpler — implementer's call) but the POST body the row builds carries `type: "event"`. Document this special-case branch with a comment referencing Spec 05 Q3 Round 1 (B).
- [x] 4.4 Add (or extend) `app/api/favorites/search/route.test.ts` to assert: when the search query matches a Tennis tournament, the returned row has `type === "event"`, `sport === "Tennis"`, and `externalId === "tennis/slam/wimbledon"` (or similar).
- [x] 4.5 Capture two screenshots in `docs/specs/05-spec-tennis/05-proofs/`: `05-search-tennis.png` (search results when typing "wimbledon" — Wimbledon row visible with sport "Tennis") and `05-favorite-added.png` (the Wimbledon row's "Add" button in "Added" state after a successful POST).
- [x] 4.6 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`. Commit using `feat(tennis): tennis tournaments in favorites typeahead with year-less event ids` with body `Related to T4.0 in Spec 05-spec-tennis`.

### [x] 5.0 Release note + proof bundle + full CI gate verification

Maps Spec Success Metric §5 and §6. Append a release note to `README.md`, write the proof-index README, capture the full CI gate transcript and touched-files list, and verify Success Metric §6 (no out-of-scope edits to forbidden paths). Depends on T1.0 through T4.0. Commits with body `Related to T5.0 in Spec 05-spec-tennis`.

#### 5.0 Proof Artifact(s)

- Diff: `README.md` shows the new "Release notes" line referencing Spec 05 and identifying `v7-espn-tennis` as the deploy invalidation mechanism.
- File: `docs/specs/05-spec-tennis/05-proofs/05-ci-gates.txt` — full transcript of `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`, all gates exit 0.
- File: `docs/specs/05-spec-tennis/05-proofs/05-touched-files.txt` — `git diff --name-only origin/main..HEAD` output; verified against Success Metric §6 (no edits outside the allowed file set).
- File: `docs/specs/05-spec-tennis/05-proofs/README.md` — proof index mapping each artifact to the FR or success metric it evidences.

#### 5.0 Tasks

- [x] 5.1 Append a one-line entry to `README.md` under **Operations → Release notes**: a 2026-MM-DD-prefixed line referencing Spec 05, noting Tennis (Grand Slams + ATP/WTA 1000s, marquee only) is now supported, with `CACHE_KEY_PREFIX` bumped to `v7-espn-tennis` as the deploy invalidation mechanism.
- [x] 5.2 Run the full CI gate suite locally: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`. Capture transcript to `docs/specs/05-spec-tennis/05-proofs/05-ci-gates.txt`.
- [x] 5.3 Verify Success Metric §6: run `git diff --name-only origin/main..HEAD` (after committing T1–T4) and confirm the output stays inside the allowed file set (no edits to `app/api/auth/`, `app/api/favorites/[id]/`, `app/api/home/`, `db/schema/`, `components/bottom-nav.tsx`, etc.). Capture file list to `docs/specs/05-spec-tennis/05-proofs/05-touched-files.txt` with a header note explaining the §6 boundary.
- [x] 5.4 Write `docs/specs/05-spec-tennis/05-proofs/README.md` indexing every artifact (endpoint verification, CI transcript, touched-files list, screenshots, task-N proof files) with a column mapping each to the spec FR or success metric it evidences.
- [x] 5.5 Write task-level proof markdowns (`05-task-01-proofs.md`, `05-task-02-proofs.md`, `05-task-03-proofs.md`, `05-task-04-proofs.md`) using the recommended structure (Task Summary → What This Task Proves → Evidence Summary → per-artifact "What it proves / Why it matters" → Reviewer Conclusion). Inline the screenshots.
- [x] 5.6 Commit using `docs(tennis): release note + proof bundle for Spec 05` with body `Related to T5.0 in Spec 05-spec-tennis`.
