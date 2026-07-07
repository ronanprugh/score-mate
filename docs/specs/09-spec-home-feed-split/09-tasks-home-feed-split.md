# 09-tasks-home-feed-split.md

Spec: [`09-spec-home-feed-split.md`](./09-spec-home-feed-split.md)

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `components/bottom-nav.tsx` | Add Teams nav item to `NAV_ITEMS`; update to 4 destinations. |
| `components/bottom-nav.test.tsx` | Update to assert exactly 4 nav items with correct `href`s. |
| `components/nav-icons.tsx` | Add `TeamsIcon` inline SVG component. |
| `components/entity-card.tsx` | **New.** Presentational card for one team/player entity (last + next match rows). |
| `components/entity-card.test.tsx` | **New.** Tests for entity card: full data, no data, partial data, player fallback. |
| `components/teams-client.tsx` | **New.** `"use client"` component that owns the `/api/teams` fetch, polling, and renders entity cards — mirrors `HomeClient` pattern. |
| `components/teams-client.test.tsx` | **New.** Tests for `TeamsClient`: initial fetch triggered on mount; abort controller fires on unmount. |
| `components/home-client.tsx` | Add `hasLeagueFavorites` prop; render a distinct "teams-only" callout when user has no league/sport/event favorites. |
| `components/home-client.test.tsx` | Add test: `TeamsOnlyPrompt` renders when `hasLeagueFavorites === false` and `hasFavorites === true`. |
| `components/favorites-search.tsx` | Add `player` to `TYPE_LABEL` so player results display the correct label. |
| `components/favorites-list.tsx` | Add `"player"` to `SECTION_ORDER`, `SECTION_LABEL`, and `groupByType`. |
| `app/(app)/teams/page.tsx` | **New.** Server component: auth check, list favorites, render `TeamsClient` or empty state. |
| `app/(app)/teams/page.test.tsx` | **New.** Test empty state and loading state for the Teams page. |
| `app/(app)/home/page.tsx` | Pass `hasLeagueFavorites` flag to `HomeClient` based on filtered favorites. |
| `app/api/teams/route.ts` | **New.** Auth-gated GET handler returning `TeamsEnvelope` — team + player entity data. |
| `app/api/teams/route.test.ts` | **New.** Unit tests for the teams route: happy path, empty ESPN result, player fallback. |
| `app/api/favorites/search/route.ts` | Extend to fan out ESPN athlete search and include player results. |
| `app/api/favorites/search/route.test.ts` | Add test case: query returns at least one `type: "player"` result. |
| `lib/teams/types.ts` | **New.** Shared `EntityMatch`, `TeamEntity`, `TeamsEnvelope` TypeScript interfaces. |
| `lib/home/aggregator.ts` | Filter out `team`/`player` favorites in `planLeagueKeys` and `aggregateMatchesForUser`. |
| `lib/home/aggregator.test.ts` | Add tests: team favorites excluded from `planLeagueKeys`; teams-only user returns empty envelope. |
| `lib/espn/catalog.ts` | Add `findCatalogTeamById(id)` helper to resolve a team's `leagueKey` from the committed catalog. |
| `lib/espn/client.ts` | Add `searchAthletes(leagueKey, q)` and `athleteSchedule(leagueKey, athleteId)` fetch functions. |
| `lib/sports/types.ts` | Add `"player"` to `FavoriteType` union and `FAVORITE_TYPES` array. |
| `db/schema/favorites.ts` | Add `"player"` to `favoriteTypeEnum`. |
| `db/migrations/<timestamp>_add_player_favorite_type.sql` | **New.** Generated migration: `ALTER TYPE favorite_type ADD VALUE IF NOT EXISTS 'player'`. |
| `docs/specs/09-spec-home-feed-split/09-proofs/` | Directory for screenshot proof artifacts. |

### Notes

- Unit tests live next to their source file (e.g. `entity-card.tsx` → `entity-card.test.tsx`).
- Run tests with `pnpm test:ci`; run a single file with `pnpm vitest run <path>`.
- Quality gate before every commit: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`.
- DB migration: update `db/schema/favorites.ts` first, then run `pnpm db:generate` to produce the SQL migration, then commit both the schema change and the generated `.sql` file. Apply to dev DB with `pnpm db:migrate`.
- ESPN athlete endpoints are undocumented and may vary by sport/league — always wrap fetches in try/catch and fall back gracefully.

---

## Tasks

### [x] 1.0 Teams destination shell & 4-item bottom nav

**Demoable:** The Teams tab appears in the bottom nav, is reachable, and shows a meaningful empty state when the user has no team or player favorites.

#### 1.0 Proof Artifact(s)

- Test: `components/bottom-nav.test.tsx` updated — asserts exactly four nav items (Home, Teams, Favorites, Settings), each with an `<svg>` child and correct `href`, with `aria-current="page"` on the active item and `min-h-11` on each link — demonstrates the nav update.
- Test: `app/(app)/teams/page.test.tsx` — asserts the empty state renders with a link to `/favorites` when the user has no team or player favorites, and a loading state is rendered before data arrives — demonstrates the shell behavior.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-teams-empty.png` — the Teams page with its empty state visible and the four-item bottom nav (Home · Teams · Favorites · Settings) — demonstrates the navigation change and shell are live.

#### 1.0 Tasks

- [x] 1.1 Add a `TeamsIcon` inline SVG component to `components/nav-icons.tsx`. Use an outline "people" or "person" glyph sized `h-6 w-6` and `aria-hidden`, consistent with the existing `HomeIcon`, `FavoritesIcon`, and `SettingsIcon` style.
- [x] 1.2 In `components/bottom-nav.tsx`, add a Teams entry to `NAV_ITEMS` between Home and Favorites: `{ href: "/teams", label: "Teams", Icon: TeamsIcon }`. Import `TeamsIcon` from `./nav-icons`.
- [x] 1.3 Update `components/bottom-nav.test.tsx` to assert exactly 4 items (Home, Teams, Favorites, Settings), each rendered with an `<svg>` and the correct `href`. Verify `aria-current="page"` is set only on the active item.
- [x] 1.4 Create `app/(app)/teams/page.tsx` as a server component. Call `auth()` and redirect to `/signin` if there is no session. Call `listFavoritesForUser(session.user.id)` and check whether any favorites have `type === "team"` or `type === "player"`. Render a `<main>` with a `TeamsClient` component if there are team/player favorites, or an empty-state `<section>` otherwise. The empty state must include an `<a href="/favorites">` link labelled "Add a team or player".
- [x] 1.5 Create `app/(app)/teams/page.test.tsx`. Mock `auth()` and `listFavoritesForUser`. Write two tests: (a) when favorites returns an empty array, the empty-state section renders with a link to `/favorites`; (b) when favorites includes a `team` favorite, a loading/placeholder element renders (the `TeamsClient` content is not yet data-driven in this task).

---

### [x] 2.0 Team entity cards, `/api/teams` endpoint & home-feed exclusion

**Demoable:** The Teams page shows one entity card per followed team, each displaying a Last match row and a Next match row. The Home page no longer shows team-type matches.

#### 2.0 Proof Artifact(s)

- Test: `app/api/teams/route.test.ts` — asserts the endpoint returns `{ entities: [{ displayName, type: "team", lastMatch, nextMatch }], source }` for a user with one team favorite (using a fixture for `teamScheduleForLeague`) — demonstrates the data contract and team schedule integration.
- Test: `components/entity-card.test.tsx` — three cases: team with last+next data, team with no data, team with only a next match — demonstrates the card renders correctly in every data state.
- Test: `lib/home/aggregator.test.ts` updated — asserts that `team`-type favorites are excluded from the `planLeagueKeys` output and that a user with only team favorites returns an empty envelope — demonstrates the home-feed exclusion.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-teams-cards.png` — the Teams page with at least one entity card showing a "Last match" row and "Next match" row — demonstrates the card layout.

#### 2.0 Tasks

- [x] 2.1 Create `lib/teams/types.ts`. Define and export:
  ```ts
  interface EntityMatch { opponentName: string; date: string; score?: string; kickoffUtc?: string | null; leagueName: string; }
  interface TeamEntity { favoriteId: string; displayName: string; type: "team" | "player"; sport: Sport; badgeUrl?: string; lastMatch: EntityMatch | null; nextMatch: EntityMatch | null; }
  interface TeamsEnvelope { entities: TeamEntity[]; source: { ok: boolean; errors: string[] }; }
  ```
  Import `Sport` from `@/lib/sports/types`.
- [x] 2.2 Add `findCatalogTeamById(id: string): CatalogTeam | null` to `lib/espn/catalog.ts`. It should scan `ALL_CATALOG_TEAMS` and return the first team whose `id` matches, or `null`. This is needed so the route handler can look up a team's `leagueKey` from its stored ESPN team ID.
- [x] 2.3 Create `app/api/teams/route.ts`. It is a server-only GET handler:
  1. Call `auth()` and return 401 if no session.
  2. Call `listFavoritesForUser(session.user.id)` and filter to `type === "team"` or `type === "player"` favorites.
  3. For each `team` favorite: call `findCatalogTeamById(fav.externalId)` to get `leagueKey`. If not found in catalog, push a `TeamEntity` with `lastMatch: null` and `nextMatch: null`. If found, call `teamScheduleForLeague(leagueKey, fav.externalId)` (already implemented in `lib/espn/client.ts`), then extract: the most recently completed match (`status === "final"`) as `lastMatch` and the soonest upcoming match (`status === "upcoming"`) as `nextMatch`. Wrap in `try/catch`; on error push the entity with null matches and record the error in `errors[]`.
  4. Return `NextResponse.json(envelope)`.
  For `player` favorites: return `null` for both matches for now — player data wiring comes in Task 4.0.
- [x] 2.4 Create `app/api/teams/route.test.ts`. Mock `auth`, `listFavoritesForUser`, `findCatalogTeamById`, and `teamScheduleForLeague`. Write tests:
  - User with one team favorite whose catalog lookup succeeds and ESPN returns matches → response includes `lastMatch` with a score and `nextMatch` with a kickoff time.
  - User with one team favorite whose catalog lookup returns `null` → entity has `lastMatch: null`, `nextMatch: null`, `source.ok: false` (or entity is still returned gracefully, depending on your implementation choice).
  - Unauthenticated request → 401.
- [x] 2.5 Create `components/entity-card.tsx`. It is a presentational server or client component (no data fetching). Props: `entity: TeamEntity`. Render a bordered card (`border border-zinc-200 dark:border-zinc-800 rounded-lg p-4`) with: (a) team/player name in `font-semibold` with an optional badge `<img>`, (b) a "Last match" row showing score, opponent, and short date — or the text "No recent match" when `lastMatch` is null, (c) a "Next match" row showing opponent and formatted kickoff time — or "No upcoming match" when `nextMatch` is null, (d) "Match data unavailable" for both rows when both are null (used for player fallback in Task 4).
- [x] 2.6 Create `components/entity-card.test.tsx`. Use React Testing Library. Three test cases: (a) entity with `lastMatch` and `nextMatch` both populated — asserts opponent names and score render; (b) entity with both null — asserts "No recent match" and "No upcoming match"; (c) entity with `nextMatch` only — asserts "No recent match" for last and opponent name for next.
- [x] 2.7 Create `components/teams-client.tsx` as a `"use client"` component. It mirrors `HomeClient` in structure: accepts no props beyond what `app/(app)/teams/page.tsx` passes, fetches `${APP_BASE_PATH}/api/teams` on mount, polls every 60 seconds when any entity has a live match (`lastMatch` score contains live-progress text — or omit live detection in v1 and poll unconditionally), aborts on unmount/tab-hide, renders a list of `<EntityCard>` components, and handles loading/error states.
- [x] 2.7a Create `components/teams-client.test.tsx`. Mock `global.fetch` and `AbortController`. Write two tests: (a) on initial render, `fetch` is called with a URL containing `/api/teams` — demonstrates the initial data load is triggered; (b) when the component unmounts (call the `useEffect` cleanup), `AbortController.abort()` has been called — demonstrates the in-flight request is cancelled. Mirror the test structure in `components/home-client.test.tsx`.
- [x] 2.8 Update `app/(app)/teams/page.tsx`: import `TeamsClient` and render it in the branch where the user has team/player favorites (replacing the placeholder from Task 1.4).
- [x] 2.9 Modify `lib/home/aggregator.ts`:
  - In `planLeagueKeys`: before building the sports set, filter `favorites` to exclude `type === "team"` and `type === "player"`. Name the filtered list `leagueFavorites` and use it in place of `favorites` for the `sports` set and the loop.
  - In `aggregateMatchesForUser`: compute `leagueFavorites = favorites.filter(...)` once, pass it to `planLeagueKeys` and to `buildHomeEnvelope`.
- [x] 2.10 Update `app/(app)/home/page.tsx`: after `listFavoritesForUser`, compute a boolean `hasLeagueFavorites` (true if any favorite has `type !== "team"` and `type !== "player"`). Pass it as a prop to `HomeClient` in addition to the existing `hasFavorites`.
- [x] 2.11 Update `components/home-client.tsx`: add `hasLeagueFavorites: boolean` to the `Props` interface. In the render logic, add a `TeamsOnlyPrompt` for when `!hasLeagueFavorites && hasFavorites && totalItems === 0` — this should display text like "Your team matches live in the Teams tab" with a link to `/teams`. This sits alongside the existing `NoFavoritesPrompt` and `NoMatchesEmptyState` cases (it does not replace them).
- [x] 2.12 Update `lib/home/aggregator.test.ts`: add a test that passes a favorites list containing only a `team`-type row to `planLeagueKeys` and asserts the result is an empty array. Add a second test that passes the same list to `aggregateMatchesForUser` (with an empty mock fetcher) and asserts the returned envelope has empty `yesterday`/`today`/`tomorrow` arrays.
- [x] 2.13 Update `components/home-client.test.tsx`: add a test for the `TeamsOnlyPrompt` case. Render `HomeClient` with `hasFavorites={true}` and `hasLeagueFavorites={false}`. Mock `/api/home` to return an empty envelope. Assert that the element with the "Teams" link (pointing to `/teams`) renders and that neither `NoFavoritesPrompt` nor `NoMatchesEmptyState` is shown.

---

### [ ] 3.0 Player favorite type (DB migration, TypeScript, search)

**Demoable:** A user can search an athlete name in the Favorites screen, see a "Players" result section, and save a player favorite to the database.

#### 3.0 Proof Artifact(s)

- Migration file: `db/migrations/<timestamp>_add_player_favorite_type.sql` exists with `ALTER TYPE "favorite_type" ADD VALUE IF NOT EXISTS 'player'` and can be applied by `pnpm db:migrate` without error — demonstrates the schema change.
- Test: `app/api/favorites/search/route.test.ts` updated — asserts that a query matching a mocked ESPN athlete result returns at least one item with `type: "player"`, a non-empty `externalId`, a non-empty `displayName`, and a valid `sport` — demonstrates player search returns the correct shape.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-player-search.png` — the Favorites search screen with an athlete name in the query field and at least one "Player" result row visible — demonstrates the end-to-end search UI.

#### 3.0 Tasks

- [ ] 3.1 In `lib/sports/types.ts`, add `"player"` to the `FavoriteType` union: `export type FavoriteType = "team" | "sport" | "league" | "event" | "player";`. Also add `"player"` to the `FAVORITE_TYPES` readonly array.
- [ ] 3.2 In `db/schema/favorites.ts`, add `"player"` to the `favoriteTypeEnum` call: `pgEnum("favorite_type", ["team", "sport", "league", "event", "player"])`.
- [ ] 3.3 Run `pnpm db:generate` to generate a new migration file in `db/migrations/`. Open the generated `.sql` file and verify it contains `ALTER TYPE "public"."favorite_type" ADD VALUE IF NOT EXISTS 'player'` (or equivalent). Commit the schema change and the migration file together. Apply it to your dev DB with `pnpm db:migrate`.
- [ ] 3.4 In `components/favorites-list.tsx`:
  - Add `"player"` to the `SECTION_ORDER` array (place it before `"team"` or after, per preference — before is recommended so players appear at the top of the saved list).
  - Add `player: "Players"` to `SECTION_LABEL`.
  - Add `player: []` to the initial object returned by `groupByType`.
- [ ] 3.5 In `components/favorites-search.tsx`, add `player: "Player"` to the `TYPE_LABEL` record so search results with `type === "player"` display "Player" as the type label.
- [ ] 3.6 Add a `searchAthletes(leagueKey: string, q: string, opts?: ClientOptions): Promise<{ id: string; displayName: string }[]>` function to `lib/espn/client.ts`. It fetches `${SITE_BASE}/${leagueKey}/athletes?search=${encodeURIComponent(q)}&limit=25` and maps the `athletes[]` array in the response to `{ id, displayName }`. Return `[]` on any error (the caller wraps this in a fan-out with per-call error suppression).
- [ ] 3.7 In `app/api/favorites/search/route.ts`, after the existing `teamResults` block, add an athlete search fan-out:
  1. For each `Sport` in `SUPPORTED_SPORTS`, get `leagueKeys` from `leagueKeysForSport(sport)` and call `searchAthletes(leagueKey, q)` for the first/primary league key for that sport (avoid calling every league per sport to keep latency low).
  2. Map results to `{ type: "player", externalId: athlete.id, displayName: athlete.displayName, sport }`.
  3. Deduplicate by athlete ID across all sports.
  4. Cap at `PER_CATEGORY_CAP` and append to `results` before returning.
  5. Wrap each `searchAthletes` call in `try/catch` and silently skip failures.
- [ ] 3.8 Update `app/api/favorites/search/route.test.ts`: add a test that mocks `searchAthletes` to return one result and asserts the route's response includes a player result with `type: "player"`, the correct `externalId`, and the correct `sport`.

---

### [ ] 4.0 Player entity cards on the Teams page

**Demoable:** A saved player favorite appears on the Teams page as an entity card showing Last match and Next match rows (or a graceful "Match data unavailable" message when ESPN has no data).

#### 4.0 Proof Artifact(s)

- Test: `app/api/teams/route.test.ts` updated — adds a `player`-type fixture asserting the endpoint returns `lastMatch`/`nextMatch` rows when ESPN returns data, and returns `null`/`null` with `source.ok === false` when ESPN's athlete endpoint throws — demonstrates player data handling and graceful fallback.
- Test: `components/entity-card.test.tsx` updated — adds a "player with data" case asserting match rows render, and a "player with `lastMatch: null` and `nextMatch: null`" case asserting "Match data unavailable" renders for both rows — demonstrates graceful degradation.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-player-card.png` — the Teams page with a player entity card visible showing either match rows or "Match data unavailable" — demonstrates the full player-favorites flow end to end.

#### 4.0 Tasks

- [ ] 4.1 **Spike:** Investigate the ESPN athlete event/schedule endpoint. Try fetching `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/athletes/{id}/eventlog` for a known athlete in each major sport (e.g. a tennis player, a soccer player). Note the response shape in a code comment at the top of the new function in `lib/espn/client.ts`. If the endpoint does not exist or returns no useful event data, document the finding and confirm the graceful-fallback path is the only outcome.
- [ ] 4.2 Add `athleteSchedule(leagueKey: string, athleteId: string, opts?: ClientOptions): Promise<{ lastMatch: EntityMatch | null; nextMatch: EntityMatch | null }>` to `lib/espn/client.ts`. Use the endpoint verified in 4.1. Map the first completed event found to `lastMatch` and the first upcoming event to `nextMatch`. Return `{ lastMatch: null, nextMatch: null }` on any fetch or parse error (do not throw). Import `EntityMatch` from `@/lib/teams/types`.
- [ ] 4.3 In `app/api/teams/route.ts`, replace the placeholder `player` branch (which returns null matches) with a call to `athleteSchedule(primaryLeagueKey, fav.externalId)`. Derive `primaryLeagueKey` by taking the first key from `leagueKeysForSport(fav.sport)`. Wrap in try/catch; on error add to `errors[]` and use `{ lastMatch: null, nextMatch: null }`.
- [ ] 4.4 Update `app/api/teams/route.test.ts`: add a player fixture where `athleteSchedule` resolves with real match data — assert `lastMatch` and `nextMatch` appear in the entity. Add a second case where `athleteSchedule` throws — assert the entity is still returned with `null` matches and `source.ok === false`.
- [ ] 4.5 Update `components/entity-card.test.tsx`: add a test where `entity.type === "player"` and both `lastMatch`/`nextMatch` are populated — asserts match rows render. Add a test where both are `null` — asserts "Match data unavailable" appears in both rows (this is the text `entity-card.tsx` should render when `lastMatch === null && nextMatch === null`; update the component if needed to handle this case distinct from the partial-data case).
