# 09-spec-home-feed-split.md

## Introduction/Overview

The current Home page surfaces matches for all favorite types (teams, leagues, sports, events) in a single unified feed. This spec splits that feed into two distinct destinations: **Home** (renamed conceptually to "Leagues") shows the existing day-window feed for `league`, `sport`, and `event` favorites, while a new **Teams** destination — added as a fourth item to the bottom nav — shows a compact per-entity view for `team` and `player` favorites, displaying each entity's most recent completed match and next upcoming match. A new `player` favorite type is introduced (DB migration + ESPN athlete search), enabling users to follow individual athletes like Coco Gauff alongside teams like the US Men's National Team.

## Goals

- Add a **Teams** destination to the bottom navigation (four items: Home · Teams · Favorites · Settings) that shows one compact card per followed team or player.
- Each team/player card displays the entity's **last completed match** (score, opponent, date) and **next upcoming match** (opponent, date/time) fetched from ESPN's per-team schedule endpoint.
- Introduce a **`player` favorite type**: DB migration extends the `favorite_type` enum; the favorites search endpoint returns matching ESPN athletes; player favorites appear as entity cards on the Teams page.
- **Home feed becomes Leagues-only**: the `/api/home` aggregator excludes `team` and `player` favorites so their matches no longer appear in the day-window feed — the Home tab is now a clean league/tournament view.
- No duplication: a team's matches appear exclusively in the Teams destination, not in both places.

## User Stories

- **As a signed-in user**, I want a Teams destination in the bottom nav so I can jump directly to my followed teams and players without scrolling through league matches.
- **As a user who follows the US Men's National Team**, I want to see their most recent result and next fixture on one card so I can check in at a glance without searching through a league feed.
- **As a tennis fan**, I want to search for and follow Coco Gauff as a player favorite so I can see her latest match result and her next scheduled match from the Teams page.
- **As a user who follows Wimbledon**, I want the Home feed to continue showing only league/tournament content so it isn't cluttered with team matches I already see in Teams.

## Demoable Units of Work

### Unit 1: Teams destination shell & nav update

**Purpose:** Add the Teams route and update the bottom nav to four items so the new destination is reachable, even before match data is wired up.

**Functional Requirements:**
- The system shall add a `/teams` route under `app/(app)/teams/page.tsx`, protected by the existing `(app)` auth guard.
- The bottom nav shall render exactly four destinations in order: **Home** (`/home`), **Teams** (`/teams`), **Favorites** (`/favorites`), **Settings** (`/settings`), each with an inline SVG icon above its text label (no new icon dependency).
- Each of the four nav items shall remain a ≥44×44 px touch target (`min-h-11`/`min-w-11`) and maintain `aria-current="page"` on the active route.
- The Teams page shall render a meaningful empty state when the user has no `team` or `player` favorites, with a link to `/favorites` to add some.
- The Teams page shall render a loading skeleton or message while match data is being fetched.

**Proof Artifacts:**
- Test: `components/bottom-nav.test.tsx` updated to assert exactly four items (Home, Teams, Favorites, Settings), each with an `svg` and correct `href` — demonstrates the nav update.
- Test: `app/(app)/teams/page.test.tsx` asserts the empty-state renders with a link to `/favorites` when user has no team/player favorites — demonstrates the shell.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-teams-empty.png` showing the Teams page empty state and the four-item bottom nav — demonstrates both changes.

### Unit 2: Team entity cards & home-feed exclusion

**Purpose:** Populate the Teams page with one compact entity card per `team` favorite, showing last completed match and next upcoming match, and stop showing team matches in the Home feed.

**Functional Requirements:**
- The system shall add a `GET /api/teams` route handler that, for each `team` (and `player`) favorite belonging to the authenticated user, returns: the favorite's display name, badge URL, and up to one last completed match + one next upcoming match (sport, league name, opponent, date, score if final, kickoff time if upcoming). The endpoint is auth-gated.
- For `team` favorites, the system shall fetch schedule data from ESPN's per-team schedule endpoint (`/sports/{sport}/{league}/teams/{teamId}/schedule`), extract the most recently completed event and the soonest upcoming event, and return them in the API response.
- The Teams page client component shall fetch `/api/teams`, poll for live updates at 60-second intervals (matching the Home page pattern), and abort in-flight requests on unmount or page hide.
- The system shall render one **entity card** per team favorite, showing: team name (and badge if available), a "Last match" row (opponent, score, date), and a "Next match" row (opponent, date/time). If no last or next match is available, the respective row shows "No recent match" or "No upcoming match."
- The `/api/home` aggregator shall exclude favorites of type `team` and `player` when computing the match set — their matches no longer appear in the day-window feed.
- The Home page shall display an appropriate empty state when the user has only `team`/`player` favorites (i.e., no league/sport/event favorites to show).

**Proof Artifacts:**
- Test: `app/api/teams/route.test.ts` asserts the endpoint returns entity data shaped as `{ favorites: [{ displayName, lastMatch?, nextMatch? }] }` for a user with team favorites — demonstrates the data contract.
- Test: `lib/home/aggregator.test.ts` updated to assert that `team` and `player` type favorites are excluded from the aggregated match set — demonstrates the home-feed exclusion.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-teams-cards.png` showing the Teams page with at least one entity card displaying last/next match rows — demonstrates the card layout.

### Unit 3: Player favorite type (DB + search)

**Purpose:** Introduce `player` as a first-class favorite type so users can search for and save individual athletes.

**Functional Requirements:**
- The system shall add a DB migration that extends the `favorite_type` Postgres enum to include `"player"` (`db/migrations/`; applied via `pnpm db:migrate`).
- The `GET /api/favorites/search` route shall query ESPN's athlete search endpoint for each supported sport when `q` is non-empty, returning results typed as `{ type: "player", externalId: <athleteId>, displayName: <name>, sport }`. Results are capped at `PER_CATEGORY_CAP` per sport (matching the existing per-category cap pattern).
- The system shall add `"player"` to the `FavoriteType` union in `lib/sports/types.ts` and to `FAVORITE_TYPES` and the `favoriteTypeEnum` in `db/schema/favorites.ts`.
- The `POST /api/favorites` validator shall accept `type: "player"` in the same `CreateFavoriteInput` shape — no other API change is needed.
- The Favorites search UI shall display player results in a "Players" section (matching the existing grouped layout for Teams, Leagues, Sports) with a player icon or label distinguishing them from team results.

**Proof Artifacts:**
- Migration file: `db/migrations/<timestamp>_add_player_favorite_type.sql` exists and correctly alters the enum — demonstrates the schema change.
- Test: `app/api/favorites/search/route.test.ts` updated to assert that a query matching an athlete name returns at least one result with `type: "player"` — demonstrates player search returns correct shape.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-player-search.png` showing "Gauff" in the favorites search typeahead returning a player result — demonstrates end-to-end search.

### Unit 4: Player entity cards on the Teams page

**Purpose:** Player favorites appear in the Teams page with the same last/next match card pattern as team favorites, so following an athlete is functionally equivalent to following a team from the Teams page perspective.

**Functional Requirements:**
- The `GET /api/teams` endpoint shall handle `player`-type favorites by querying ESPN's athlete-specific endpoints to find the athlete's most recent completed match and next upcoming match. The response shape is identical to team entity cards.
- The Teams page shall render `player` favorites alongside `team` favorites in a single flat list, sorted by favorite `createdAt` descending (most recently added first), with no separate section header distinguishing teams from players.
- A player entity card shall display the athlete's name, their last match (opponent name, score, date), and their next match (opponent name, date/time), with graceful "No data" rows when ESPN returns no results for that athlete.
- If ESPN's player schedule API is unavailable or returns no useful data for a given player, the entity card shall render the player's name with both rows showing "Match data unavailable" — the card never crashes the page.

**Proof Artifacts:**
- Test: `app/api/teams/route.test.ts` updated with a fixture for a `player` favorite asserting the endpoint returns last/next match rows (or graceful nulls) for the athlete — demonstrates player data handling.
- Test: `components/entity-card.test.tsx` (new component) asserts the card renders correctly for both the "team with data", "player with data", and "no data" cases — demonstrates graceful degradation.
- Screenshot: `docs/specs/09-spec-home-feed-split/09-proofs/09-player-card.png` showing a player entity card (e.g. a tennis player) with last/next match rows on the Teams page — demonstrates the full player flow.

## Non-Goals (Out of Scope)

1. **Filtering or sorting the Teams page** — no sort controls, filter by sport, or grouping by sport in this spec. The flat list sorted by recency is sufficient.
2. **Live match updates on the Teams page beyond 60-second polling** — no WebSocket or server-sent events; same polling strategy as the Home page.
3. **Deep match detail pages** — tapping a match in an entity card does not navigate anywhere; cards are display-only.
4. **Push notifications for team/player events** — no notification system in this spec.
5. **"Sport" favorites in the Teams destination** — sport-level favorites (`type: "sport"`) remain in the Home feed only; they do not generate entity cards on the Teams page.
6. **Player profile pages** — `/teams/{playerId}` detail pages are not in scope; the Teams page is a flat list of entity cards.
7. **Backward-compat for four-item nav on very narrow screens** — the nav uses `justify-around` on a `max-w-md` container; no custom breakpoints beyond what already exists.
8. **Changes to the Favorites add/remove flow** — how favorites are added and removed is unchanged; this spec only changes where they are *displayed*.

## Design Considerations

- **Bottom nav (4 items):** The existing nav uses `justify-around` inside `max-w-md`. Adding a fourth item tightens spacing; the `flex-1` pattern means each item takes equal width. Icon size stays at `h-6 w-6`; label stays at `text-xs`. A simple "person with jersey" or "group" outline SVG is appropriate for the Teams icon — consistent with the existing outline glyph style in `nav-icons.tsx`. Confirm the chosen glyph is visually distinct from the existing Home/Favorites/Settings icons.
- **Entity card:** A bordered card (matching `border border-zinc-200 dark:border-zinc-800 rounded-lg`) with three rows: (1) team/player name in `font-semibold` with optional badge `img` at left, (2) "Last" row in `text-sm text-zinc-600` with score, opponent, and short date, (3) "Next" row in `text-sm text-zinc-600` with opponent and formatted kickoff time. Cards stack in a single column on mobile; could optionally grid at `sm:grid-cols-2` matching the existing match card grid.
- **Empty state on Home:** If the user has league/sport/event favorites but no matches for the current window, the existing `NoMatchesEmptyState` is unchanged. If the user has *only* team/player favorites (zero league/sport/event), the Home page shows a callout explaining that team matches live in the Teams tab, with a link to `/teams`.
- Honor `min-h-dvh`, safe-area insets, and `min-h-11`/`min-w-11` touch targets per `AGENTS.md`.

## Repository Standards

- Next.js 16 App Router; server components by default. The Teams page client component gets `"use client"` because it owns the fetch/poll lifecycle (same pattern as `HomeClient`). The route handler is a server-side file in `app/api/teams/route.ts`.
- TypeScript `strict`, no `any`. The API response type for `/api/teams` is defined and exported from `lib/teams/types.ts` (new file) so the client component and route handler share a contract.
- Tailwind v4 mobile-first. No new runtime dependencies (Teams icon is inline SVG in `nav-icons.tsx`).
- Vitest + React Testing Library, colocated tests. New files: `app/api/teams/route.test.ts`, `app/(app)/teams/page.test.tsx`, `components/entity-card.test.tsx`.
- ESLint + Prettier pass with `pnpm lint && pnpm format:check`. TypeScript passes with `pnpm typecheck`.
- Conventional Commits with `Related to T#.# in Spec 09-spec-home-feed-split` in the body.
- DB migration file committed to `db/migrations/` and applied before testing Unit 3+.

## Technical Considerations

- **ESPN per-team schedule endpoint:** `GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}/schedule` — already documented in `lib/espn/client.ts` comments. Returns a `team.nextEvent` array and `team.record` with recent results. Extract the first item with `status.type.completed === true` (most recent result) and the first item with `status.type.state === "pre"` (next upcoming). This endpoint is not yet implemented in `lib/espn/client.ts`; it needs a new typed fetch function.
- **ESPN athlete search endpoint:** `GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/athletes?search={q}&limit=25` — publicly accessible, same base URL. Returns `athletes[]` with `id`, `fullName`, and `team`. The `/api/favorites/search` handler already fans out per sport; add an athlete search fan-out following the same `PER_CATEGORY_CAP` pattern. Note: not all sport+league combinations expose the athlete search endpoint — implement with `try/catch` per combination, silently skipping failures.
- **ESPN player match history:** Finding a specific player's matches may require iterating over event competitors on the per-athlete schedule endpoint (`/sports/{sport}/{league}/athletes/{id}/eventlog` or similar). This is the most uncertain part of the spec technically. If ESPN does not return a usable schedule for an athlete, the entity card gracefully renders "Match data unavailable" (see Unit 4 non-crashing requirement). Spike this endpoint early in implementation.
- **Home aggregator exclusion:** In `lib/home/aggregator.ts`, `listFavoritesForUser` currently returns all types. Add a filter before constructing the league-key set: exclude rows where `type === "team" || type === "player"`. The rest of the aggregator is unchanged.
- **`/api/teams` response contract:** Define in `lib/teams/types.ts`:
  ```ts
  interface EntityMatch { opponentName: string; date: string; score?: string; kickoffUtc?: string | null; leagueName: string; }
  interface TeamEntity { favoriteId: string; displayName: string; type: "team" | "player"; sport: Sport; badgeUrl?: string; lastMatch: EntityMatch | null; nextMatch: EntityMatch | null; }
  interface TeamsEnvelope { entities: TeamEntity[]; source: { ok: boolean; errors: string[] }; }
  ```
- **DB migration:** `ALTER TYPE favorite_type ADD VALUE 'player';` (Postgres supports `ADD VALUE` without a full type drop-and-recreate). Run via `pnpm db:migrate`. The Drizzle schema (`db/schema/favorites.ts`) and `lib/sports/types.ts` must be updated before the migration so TypeScript reflects the new value.
- **`/api/home` backward compatibility:** After excluding team/player favorites, users who have *only* team/player favorites will receive empty arrays for all three days. The Home page should handle this with a distinct callout (not the generic `NoMatchesEmptyState`), directing users to the Teams tab.

## Security Considerations

- `/api/teams` is auth-gated via `auth()` from Auth.js — same pattern as `/api/home`. Never trust a client-supplied `userId`; always derive from `session.user.id`.
- ESPN athlete and team schedule endpoints are public (no API key); no secrets are introduced. Rate-limit risk: fan-out per entity could be large if a user follows many teams/players. Cap the parallel fetch count or serialize if needed; document the cap in the route handler.
- The `player` favorite type adds no new sensitive data beyond what `team` favorites already store (externalId, displayName, sport). No PII beyond what the user voluntarily enters.
- Proof-artifact screenshots must not show real user email or personal data.

## Success Metrics

1. **Four-destination nav:** The bottom nav renders exactly Home · Teams · Favorites · Settings, each with an icon + label and correct active state. Verified by `bottom-nav.test.tsx`.
2. **Team entity cards:** A user with team favorites sees one card per team on `/teams`, each showing a last match row and a next match row (or graceful "no data" text). Verified by page test + screenshot.
3. **Player search:** A user can search "Gauff" on the Favorites screen and add a `player` favorite. Verified by search route test + screenshot.
4. **Player entity cards:** A saved player favorite appears on `/teams` with last/next match rows populated from ESPN. Verified by API test + screenshot.
5. **Home feed clean split:** The Home page no longer shows matches for team or player favorites; they appear only on the Teams page. Verified by updated aggregator test.
6. **No regressions:** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build` all exit 0.

## Open Questions

1. **ESPN athlete eventlog endpoint availability:** The exact URL path for per-athlete match history is unconfirmed. `GET /sports/{sport}/{league}/athletes/{id}/eventlog` is the likely pattern (matching ESPN's HATEOAS structure) but needs a spike before Unit 4 implementation to confirm it returns last/next match data in a parseable shape. If unavailable, Unit 4 will fallback to "Match data unavailable" cards for all players.
2. **Four-item nav visual fit on very narrow screens (< 320px):** With four equal-width items, labels may truncate at extreme narrow widths. Acceptable to truncate with `truncate` class; no design change required unless QA flags it.
3. **Teams page poll behavior when all entities return errors:** If ESPN schedule calls all fail, should the Teams page show a persistent error banner (matching the `DataSourceErrorBanner` pattern on Home) or hide the banner after the first successful partial load? Decide during implementation; bias toward showing the banner whenever `source.ok === false`.
