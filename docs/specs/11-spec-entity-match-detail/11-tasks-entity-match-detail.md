# 11-tasks-entity-match-detail.md

Task plan for [`11-spec-entity-match-detail.md`](11-spec-entity-match-detail.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `components/entity-card.tsx` | Add the whole-card link + accessible label to `/teams/[favoriteId]`; currently non-interactive. |
| `components/entity-card.test.tsx` | Add tests asserting the card is a link with an accessible label; keep existing render tests green. |
| `app/(app)/teams/[favoriteId]/page.tsx` | **New** auth-gated server route: resolve favorite, render header (name + badge) + back control, or not-found state. |
| `app/(app)/teams/[favoriteId]/page.test.tsx` | **New** tests: unauthenticated redirect, unknown/foreign `favoriteId` not-found, header render. |
| `components/entity-matches-client.tsx` | **New** `"use client"` fetcher + chronological layout (divider, focus-on-recent, empty states), rendering `MatchCard`/`TennisMatchCard`. |
| `components/entity-matches-client.test.tsx` | **New** tests: ordering (past→future), divider placement, per-section + combined empty copy, sport→card routing. |
| `app/api/teams/[favoriteId]/matches/route.ts` | **New** auth-gated, user-scoped endpoint returning recent + upcoming full `Match[]` (≤10 each) for a team or player. |
| `app/api/teams/[favoriteId]/matches/route.test.ts` | **New** tests: 10/10 cap, correct schedule source, 401 unauthenticated, foreign favorite 404, 200-with-unavailable on upstream failure. |
| `lib/teams/types.ts` | Add the `EntityMatchesEnvelope` type (entity meta + `recent: Match[]` + `upcoming: Match[]` + `source`). |
| `lib/espn/client.ts` | Reuse `teamScheduleForLeague`; add `athleteMatchHistory()` producing full `Match[]` (with `tennis` detail) for players; cap before deep-resolving. |
| `lib/espn/client.test.ts` | Add tests for `athleteMatchHistory()` (team-sport + tennis players, 10/10 cap, empty/unavailable). |
| `app/api/teams/route.ts` | Reference for existing auth-gate + favorite-resolution + graceful-degradation pattern to mirror. |
| `components/match-card.tsx` / `components/tennis-match-card.tsx` | Reused unchanged to guarantee visual parity with Home. |

### Notes

- Colocate Vitest tests next to source (`foo.tsx` + `foo.test.tsx`), following existing card/route test patterns.
- Quality gates before commit: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test:ci`.
- Next.js 16 App Router: dynamic route `params` is a `Promise` (`await ctx.params` / `await props.params`) — consult `node_modules/next/dist/docs/` before writing the route. `fetch()` is not basePath-aware, so prefix client calls with `APP_BASE_PATH` (`/ScoreMate`), as `TeamsClient`/`HomeClient` do.
- Conventional Commits; reference this spec's task IDs in commit bodies.

## Tasks

### [x] 1.0 Tappable entity cards + detail route shell with back navigation

Make each Teams-tab card a link into a new deep-linkable, auth-gated detail route (`/teams/[favoriteId]`) that renders a header (name + badge) and a back control returning to Teams, plus a friendly not-found state for unknown/foreign favorites. (Spec Unit 1; Goals 1; FR: card-as-link, accessible label, auth gate, header + back, not-found.)

#### 1.0 Proof Artifact(s)

- Screenshot: `/teams` with a visibly tappable card, and the `/teams/[favoriteId]` detail header (name + badge + back button) after tapping demonstrates end-to-end navigation.
- Test: `components/entity-card.test.tsx` asserts the card renders an anchor to `/teams/[favoriteId]` with an accessible label (e.g. "View Chicago Bulls matches") demonstrates the entry point.
- Test: `app/(app)/teams/[favoriteId]/page.test.tsx` asserts unauthenticated access redirects to sign-in and an unknown/foreign `favoriteId` renders the not-found state demonstrates the auth + ownership guards.

#### 1.0 Tasks

- [x] 1.1 In `components/entity-card.tsx`, wrap the card in a Next.js `Link` (or make the `<article>` a link) to `/teams/${entity.favoriteId}`, preserving the existing layout. Add an accessible label (e.g. `aria-label="View ${displayName} matches"`) and ensure the tap target meets ≥44px per repo conventions. Keep the Last/Next summary content unchanged.
- [x] 1.2 Create `app/(app)/teams/[favoriteId]/page.tsx` as an auth-gated server component: call `auth()`, `redirect("/signin")` when unauthenticated (mirror `teams/page.tsx`); read `favoriteId` via `await props.params`.
- [x] 1.3 In the page, resolve the favorite with `listFavoritesForUser(session.user.id)` and find the matching `favoriteId` that is a `team` or `player`. When none matches (unknown or another user's id), render a friendly not-found state (heading + short copy + link back to Teams) instead of throwing.
- [x] 1.4 Render the detail header: entity `displayName`, badge/crest when available (reuse the badge resolution used by `app/api/teams/route.ts` / catalog helper for teams), and a back control (link to `/teams`) with an accessible label. Use `min-h-dvh`, safe-area insets, and mobile-first classes matching `teams/page.tsx`.
- [x] 1.5 Add tests in `components/entity-card.test.tsx` (card renders an anchor to `/teams/[favoriteId]` with the accessible label; existing render assertions still pass) and `app/(app)/teams/[favoriteId]/page.test.tsx` (unauthenticated redirects; unknown/foreign `favoriteId` → not-found state; valid favorite → header shows name).
- [x] 1.6 Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test:ci`; capture the Teams→detail navigation screenshot proof artifact.

### [x] 2.0 Detail data endpoint + Home-style team match history

Add an auth-gated, user-scoped endpoint that returns a followed **team's** recent (completed) and upcoming matches as fully-populated `Match` objects (capped at ≤10 each) via the existing team-schedule path, and render them with the unchanged `MatchCard` so cards look identical to Home. Partial upstream failures degrade gracefully. (Spec Unit 2; Goals 2, 3; FR: endpoint returns full `Match[]`, 10/10 cap, `MatchCard` reuse, auth-scoped, graceful degradation.)

#### 2.0 Proof Artifact(s)

- Screenshot: `/teams/[favoriteId]` for a team (e.g. Chicago Bulls) showing a list of `MatchCard`s visually identical to Home demonstrates component reuse + full fidelity.
- API: `GET` of the detail endpoint for a team favorite returns ≤10 recent + ≤10 upcoming fully-populated matches (JSON excerpt) demonstrates the data contract.
- Test: `app/api/.../route.test.ts` asserts the endpoint caps counts at 10/10, returns matches from the followed team's schedule, is 401 when unauthenticated, and 200-with-unavailable on upstream failure demonstrates selection + auth + degradation.

#### 2.0 Tasks

- [x] 2.1 In `lib/teams/types.ts`, add `EntityMatchesEnvelope`: `{ entity: { favoriteId; displayName; type; sport; badgeUrl? }, recent: Match[], upcoming: Match[], source: { ok: boolean; errors: string[] } }`. Import `Match` from `lib/sports/types`.
- [x] 2.2 Add a shared helper (e.g. `splitAndCapSchedule(matches: Match[]): { recent: Match[]; upcoming: Match[] }`) — colocated in the route or a small `lib/teams/` module — that selects the ≤10 most recent `final` matches (most-recent first) and ≤10 soonest `upcoming` matches (soonest first), reusing the sort-key approach from `extractEntityMatches` in `app/api/teams/route.ts`.
- [x] 2.3 Create `app/api/teams/[favoriteId]/matches/route.ts`: `GET` handler, auth-gate (401 when no session), read `await ctx.params`, resolve the favorite via `listFavoritesForUser(session.user.id)`; return 404 when the id is not a team/player favorite owned by the user.
- [x] 2.4 For a **team** favorite: resolve the catalog team (`findCatalogTeamById`), fetch `teamScheduleForLeague(leagueKey, externalId)`, run `splitAndCapSchedule`, and return the `EntityMatchesEnvelope` (set `badgeUrl` from the catalog). On upstream failure, return 200 with empty `recent`/`upcoming` and `source.ok = false` (mirror `app/api/teams/route.ts`).
- [x] 2.5 In `components/entity-matches-client.tsx` (created here, layout completed in 4.0), fetch `${APP_BASE_PATH}/api/teams/${favoriteId}/matches` with an `AbortController`, loading/error states like `TeamsClient`, and render each team-sport `Match` with the unchanged `MatchCard`. Wire it into the detail page from 1.0.
- [x] 2.6 Add `app/api/teams/[favoriteId]/matches/route.test.ts`: caps at 10 recent + 10 upcoming; matches come from the followed team's schedule; 401 unauthenticated; 404 for unknown/foreign favorite; 200-with-`source.ok=false` on upstream failure.
- [x] 2.7 Run the quality gates; capture the team detail screenshot (Home-identical `MatchCard`s) and the API JSON excerpt proof artifacts.

### [ ] 3.0 Player match history (team-sport and tennis players)

Extend the athlete data path to resolve a **player** favorite's schedule into fully-populated `Match` objects (capped ≤10 recent + ≤10 upcoming): team-sport players (e.g. Messi) rendered with `MatchCard`, tennis players (e.g. Jannik Sinner) carrying `TennisMatchDetail` (per-player sets, flags, round/draw) rendered with the unchanged `TennisMatchCard`. No usable data shows the graceful "Match data unavailable" state. Bound fan-out (cap before deep-resolving, parallelize, reuse caching). (Spec Unit 3; Goals 2, 3; FR: full `Match` objects for players, tennis detail, 10/10 cap, `MatchCard`/`TennisMatchCard` reuse, graceful unavailable.)

#### 3.0 Proof Artifact(s)

- Screenshot: `/teams/[favoriteId]` for a tennis player (e.g. Jannik Sinner) showing `TennisMatchCard`s with set-by-set scores identical to Home demonstrates the tennis path.
- Screenshot: `/teams/[favoriteId]` for a team-sport player (e.g. Messi) showing `MatchCard`s demonstrates the team-sport player path.
- Test: `lib/espn/client.test.ts` asserts the player path returns fully-populated matches (with `tennis` detail for tennis players) capped at 10/10 and returns the empty/unavailable result when ESPN has no data demonstrates the expansion logic.

#### 3.0 Tasks

- [ ] 3.1 In `lib/espn/client.ts`, add `athleteMatchHistory(leagueKey, athleteId, opts?)` returning `Promise<{ recent: Match[]; upcoming: Match[] }>`. Reuse the eventlog fetch + item-resolution scaffolding from `athleteSchedule` (core-API `eventlog`, `$ref` resolution, `revalidateSeconds` caching), but build full `Match` objects instead of `EntityMatch`. Never throw — return empty arrays on failure.
- [ ] 3.2 Cap before deep-resolving: from the eventlog, sort items by date, take the ≤10 most recent completed and ≤10 soonest upcoming *item refs first*, then resolve only those to full detail (`Promise.all`) to bound fan-out per the spec's performance note.
- [ ] 3.3 **Team-sport players** (item has `teamId`): build a full `Match` from the resolved core `event` — both competitors' names/ids/logos, scores (when final), `status`, `dateUtc`/`kickoffUtc`, `leagueId`/`leagueName`. Ensure the followed player's team maps consistently (home/away) so `MatchCard` renders correctly.
- [ ] 3.4 **Tennis players** (item has `competition`): build a full `Match` with `sport: "Tennis"` and a populated `TennisMatchDetail` (`home`/`away` `TennisPlayerLine` with set-by-set `sets`, `flagUrl`/`flagAlt`, `seed`, plus `round`/`draw` when available), reusing existing tennis set-score parsing (`tennisSetScore` / `lib/espn/tennis.ts` helpers) so `TennisMatchCard` renders identically to Home.
- [ ] 3.5 In `app/api/teams/[favoriteId]/matches/route.ts`, add the **player** branch: resolve `leagueKey` from `fav.metadata?.leagueKey ?? leagueKeysForSport(fav.sport)[0]`, call `athleteMatchHistory`, and return the same `EntityMatchesEnvelope`. When both arrays are empty, return 200 with `source.ok` unchanged (graceful "Match data unavailable"), mirroring the player handling in `app/api/teams/route.ts`.
- [ ] 3.6 In `components/entity-matches-client.tsx`, route each `Match` to the correct card by sport: `sport === "Tennis"` → `TennisMatchCard`, else → `MatchCard`.
- [ ] 3.7 Add `lib/espn/client.test.ts` cases for `athleteMatchHistory`: team-sport player returns full `Match[]` capped 10/10; tennis player returns matches with populated `tennis` detail; no-data athlete returns empty arrays. Use fixtures consistent with existing ESPN client tests.
- [ ] 3.8 Run the quality gates; capture the tennis-player (`TennisMatchCard`) and team-sport-player (`MatchCard`) detail screenshots as proof artifacts.

### [ ] 4.0 Chronological layout with focus-on-recent + empty states

Assemble recent + upcoming into one continuous chronological list (past → future) with a subtle completed/upcoming divider, position the viewport on the most recent completed match on load (scroll up = older, down = upcoming), and render section-level empty copy ("No recent matches" / "No upcoming matches") and a single unavailable state when both are empty. Mobile-first, reusing Home's spacing/typography. (Spec Unit 4; Goals 4, 5; FR: chronological order, divider, focus-on-recent, per-section + combined empty states.)

#### 4.0 Proof Artifact(s)

- Screenshot: `/teams/[favoriteId]` on a mobile viewport showing the completed→upcoming divider positioned on the most recent match on load demonstrates focus-on-recent.
- Screenshot: `/teams/[favoriteId]` for an off-season/sparse entity showing "No upcoming matches" (or equivalent) empty copy demonstrates graceful degradation.
- Test: the detail client test asserts list ordering (past → future), divider placement, and empty-state copy for missing recent/upcoming sections demonstrates the layout logic.

#### 4.0 Tasks

- [ ] 4.1 In `components/entity-matches-client.tsx`, render a single continuous list ordered past → future: completed matches oldest→newest, then upcoming soonest→latest (transform the endpoint's `recent` — which is most-recent-first — into ascending order for display).
- [ ] 4.2 Insert a subtle divider between the last completed and first upcoming match marking the "today"/now boundary (styled with Home's zinc/divide conventions). When one side is empty, place the divider sensibly (or omit it) without breaking layout.
- [ ] 4.3 On mount, scroll the most recent completed match (the item just above the divider) into view using a `ref` + `scrollIntoView`, so the screen opens focused on recent form; guard against layout shift from lazy-loading card images (e.g. scroll after data render / images `loading="lazy"`).
- [ ] 4.4 Add empty states: "No recent matches" when `recent` is empty, "No upcoming matches" when `upcoming` is empty, and a single "Match data unavailable" message when both are empty (reuse Teams/Home empty-copy tone). Keep the `DataSourceErrorBanner` behavior when `source.ok === false`, consistent with `TeamsClient`.
- [ ] 4.5 Ensure mobile-first layout parity with Home (spacing, responsive grid/stack, safe-area insets) and that cards remain the unchanged `MatchCard`/`TennisMatchCard`.
- [ ] 4.6 Add `components/entity-matches-client.test.tsx`: asserts past→future ordering, divider placement between completed/upcoming, correct per-section and combined empty copy, sport→card routing (Tennis→`TennisMatchCard`, else→`MatchCard`), and — via an `Element.prototype.scrollIntoView` spy — that the most-recent-completed match element is scrolled into view on mount (focus-on-recent).
- [ ] 4.7 Run the quality gates; capture the focus-on-recent (with divider) and sparse-entity empty-state screenshots on a mobile viewport as proof artifacts.
