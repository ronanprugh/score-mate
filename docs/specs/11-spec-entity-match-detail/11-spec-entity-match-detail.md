# 11-spec-entity-match-detail.md

## Introduction/Overview

Today the Teams tab shows one compact `EntityCard` per followed team or player, summarizing only their last and next match. There is no way to drill in and see more of an entity's schedule. This feature makes each entity card tappable, opening a dedicated **match detail screen** for that specific team or player (e.g. tapping "Jannik Sinner" shows Sinner's matches; tapping "Chicago Bulls" shows the Bulls' games). The screen shows up to the **10 most recent** completed matches and the **10 next** upcoming matches, each rendered with the **exact same scorecard component used on the Home screen** (`MatchCard` for team sports, `TennisMatchCard` for tennis), and a back button that returns to the Teams tab.

The goal is a pretty, simple drill-in view that reuses existing Home visuals so an entity's recent form and upcoming fixtures are viewable at a glance, with no new card styling to maintain.

## Goals

1. Let a user tap any team or player on the Teams tab and land on a dedicated, deep-linkable detail screen for that entity, with a back button to Teams.
2. Show up to 10 recent completed matches and up to 10 upcoming matches for the selected entity, for **both** teams and players (including tennis players).
3. Render every match with the **same** component the Home screen uses for that sport, so scorecards look identical (no visual drift, no duplicated styling).
4. Present matches as a single chronological list (past → future) that opens focused on the most recent match, so recent form is visible immediately and older matches are a scroll away.
5. Degrade gracefully when an entity has fewer than 10 matches on either side, or when upstream data is unavailable.

## User Stories

- **As a sports fan following a team**, I want to tap my team on the Teams tab and see their recent results and upcoming fixtures, so that I can catch up on how they've been doing and what's next without leaving the app.
- **As a tennis fan following a player**, I want to tap that player and see their recent matches with set-by-set scores exactly like the Home screen shows them, so that the experience feels consistent and familiar.
- **As a mobile user**, I want the detail screen to open focused on the most recent match with a clear back button, so that I immediately see what matters and can return to Teams with one tap.
- **As a user of a team that's between seasons**, I want the screen to still work and simply tell me when there are no recent or no upcoming matches, so that the app never feels broken.

## Demoable Units of Work

### Unit 1: Tappable entity cards + detail route with back navigation

**Purpose:** Establish the navigation shell — clickable Teams cards, a new deep-linkable detail route, a header with the entity's name/badge, and a back button to Teams. Serves every user who wants to drill into an entity.

**Functional Requirements:**

- The system shall render each Teams-tab entity card as an accessible link/button that navigates to a per-entity detail route keyed by the favorite (e.g. `/teams/[favoriteId]`).
- The whole card shall be the tap target, with an accessible label identifying the entity (e.g. "View Chicago Bulls matches"), meeting the repo's ≥44×44px touch-target rule.
- The system shall provide a new App Router screen at the detail route that is auth-gated (redirect to sign-in when unauthenticated), consistent with existing `app/(app)/` pages.
- The detail screen shall display a header containing the entity's display name and its badge/crest when available, and a back control that returns the user to the Teams tab.
- When the route's `favoriteId` does not correspond to a team/player favorite owned by the current user, the screen shall show a friendly "not found" state rather than an error.

**Proof Artifacts:**

- Screenshot: Teams tab with a visibly tappable card, and the detail screen header (name + badge + back button) after tapping demonstrates navigation works.
- Test: A component/route test asserting the entity card renders a link to `/teams/[favoriteId]` with an accessible label demonstrates the entry point.
- Test: A route/page test asserting unauthenticated access redirects and an unknown/foreign `favoriteId` yields the not-found state demonstrates the auth + not-found guards.

### Unit 2: Team match history data + Home-style `MatchCard` list

**Purpose:** Deliver the full-fidelity experience for **team** favorites (e.g. Chicago Bulls, Arsenal), which already have complete schedule data. Serves fans following teams.

**Functional Requirements:**

- The system shall provide a server endpoint that, given a team favorite, returns that team's recent (completed) and upcoming matches as fully-populated `Match` objects (both sides, logos, scores, status), reusing the existing team-schedule data path.
- The endpoint shall cap the response to at most the 10 most recent completed matches and at most the 10 soonest upcoming matches for the entity.
- The detail screen shall render each returned team-sport match using the **existing `MatchCard` component** unchanged, so the cards are visually identical to Home.
- The endpoint shall be auth-gated and scoped to favorites owned by the requesting user.
- Partial upstream failures shall degrade gracefully (surface an unavailable state / empty result) rather than failing the whole screen, consistent with the existing Teams/Home error handling.

**Proof Artifacts:**

- Screenshot: Detail screen for a team (e.g. Chicago Bulls) showing a list of `MatchCard`s identical in appearance to Home demonstrates component reuse and full fidelity.
- API: `GET` of the detail endpoint for a team favorite returns ≤10 recent + ≤10 upcoming fully-populated matches demonstrates the data contract.
- Test: A test asserting the endpoint caps counts at 10/10 and returns matches from the followed team's schedule demonstrates the selection logic.

### Unit 3: Player match history (team-sport and tennis players)

**Purpose:** Extend full-fidelity match history to **player** favorites — both team-sport players (e.g. Messi) and tennis players (e.g. Jannik Sinner). Serves fans following individual athletes. This is the largest unit because player schedules must be expanded into full `Match` objects (tennis players additionally need set-by-set detail).

**Functional Requirements:**

- The system shall resolve a player favorite's recent and upcoming matches into fully-populated `Match` objects suitable for the appropriate Home card component, extending the existing athlete-schedule path beyond its current single last/next summary.
- For **tennis** players, each returned match shall include the tennis set-by-set detail the `TennisMatchCard` needs (per-player set scores, flags, round/draw where available), and shall be rendered with the **existing `TennisMatchCard` component**.
- For **team-sport** players, each returned match shall be rendered with the **existing `MatchCard` component**.
- The system shall cap player results at 10 recent + 10 upcoming, matching the team behavior.
- When ESPN has no usable schedule data for a player, the screen shall show the graceful "match data unavailable" state rather than an error.

**Proof Artifacts:**

- Screenshot: Detail screen for a tennis player (e.g. Jannik Sinner) showing `TennisMatchCard`s with set scores identical to Home demonstrates the tennis path.
- Screenshot: Detail screen for a team-sport player (e.g. Messi) showing `MatchCard`s demonstrates the team-sport player path.
- Test: A test asserting the player data path returns fully-populated matches (with tennis detail for tennis players) capped at 10/10 demonstrates the expansion logic.

### Unit 4: Chronological layout with focus-on-recent + empty states

**Purpose:** Assemble recent + upcoming into the single chronological list the user asked for, opening focused on the most recent match, with graceful empty states. Serves all users.

**Functional Requirements:**

- The detail screen shall present matches as one continuous chronological list ordered past → future, with a subtle visual divider between completed and upcoming matches ("today" boundary).
- On load, the screen shall be positioned so the **most recent completed match** is the focal point; scrolling up reveals older completed matches and scrolling down reveals upcoming matches.
- When there are no recent matches, the completed portion shall show a short "No recent matches" message; when there are no upcoming matches, the upcoming portion shall show a short "No upcoming matches" message.
- When an entity has neither recent nor upcoming matches (or data is unavailable), the screen shall show a single friendly unavailable/empty message.
- The layout shall be mobile-first and reuse Home's spacing/typography conventions so the screen feels like part of the same app.

**Proof Artifacts:**

- Screenshot: Detail screen on a mobile viewport showing the completed→upcoming divider, positioned on the most recent match on load, demonstrates the focus-on-recent behavior.
- Screenshot: Detail screen for an off-season/sparse entity showing the "No upcoming matches" (or equivalent) empty copy demonstrates graceful degradation.
- Test: A test asserting the list ordering (past → future), the divider placement, and the empty-state copy for missing recent/upcoming sections demonstrates the layout logic.

## Non-Goals (Out of Scope)

1. **No new scorecard design**: this feature reuses the existing `MatchCard` and `TennisMatchCard` components as-is. It does not introduce a new card style or restyle Home's cards.
2. **No live-score polling on the detail screen**: unlike Home, the detail screen does not need live auto-refresh in v1 (schedules/results are largely static). A one-time fetch (with the usual re-fetch on tab focus, if trivially inherited) is sufficient; continuous live polling is out of scope.
3. **No summary statistics**: the header shows name + badge + back only. Win/loss records, streaks, standings, or aggregate stats are out of scope.
4. **No pagination beyond 10/10**: the screen shows at most 10 recent and 10 upcoming matches. "Load more" / infinite history is out of scope.
5. **No per-match detail drill-down**: tapping an individual match card does not open a further match-detail view in this spec.
6. **No changes to which entities appear on Teams**: this spec only adds a drill-in from existing Teams cards; it does not change favoriting or the Teams list itself.

## Design Considerations

- **Visual parity with Home is the core design requirement.** Match cards must be the literal Home components: `MatchCard` for team sports, `TennisMatchCard` for tennis. No divergence in card layout, colors, or scoring display.
- **Header**: entity display name + badge/crest (reuse the badge already available for teams), plus a clearly-tappable back control returning to Teams. Keep it simple and clean ("pretty, simple").
- **Layout**: single chronological list, past → future, with a subtle divider marking the completed/upcoming boundary. On load, the viewport is positioned on the most recent completed match so recent form is the first thing seen; older matches are up-scroll, upcoming are down-scroll.
- **Mobile-first**: default utilities target small screens; use `min-h-dvh`, safe-area insets, and ≥44px touch targets per repo conventions. Card grid/stack should echo Home's responsive treatment.
- **Empty/unavailable states**: reuse the tone and styling of existing Teams/Home empty copy (e.g. "No recent matches", "No upcoming matches", "Match data unavailable").
- The `EntityCard` "Last/Next" summary treatment on the Teams tab is unchanged; only its tap behavior is added.

## Repository Standards

- **Framework**: Next.js 16 App Router. New route lives under `app/(app)/` as a server component that auth-gates and delegates data fetching to a `"use client"` component, mirroring `home/page.tsx` → `HomeClient` and `teams/page.tsx` → `TeamsClient`.
- **Before writing route/dynamic-segment code**, consult the relevant Next.js 16 guide under `node_modules/next/dist/docs/` (dynamic routes, `params`, client vs server components) — this repo's Next version differs from older conventions.
- **TypeScript strict**; no `any`, no unjustified `@ts-ignore`.
- **Data types**: reuse `Match` / `TennisMatchDetail` from `lib/sports/types.ts` and the `TeamsEnvelope`/entity contracts in `lib/teams/types.ts`; add a new detail envelope type alongside them rather than overloading existing shapes.
- **Data access**: reuse `teamScheduleForLeague` and extend the `athleteSchedule` path in `lib/espn/client.ts`; resolve favorites with `listFavoritesForUser` and the catalog helpers (`findCatalogTeamById`, `leagueKeysForSport`) as `app/api/teams/route.ts` already does.
- **Route handlers**: new endpoint under `app/api/` following the existing auth-gate + graceful-degradation pattern (200 with an unavailable flag rather than throwing).
- **Styling**: Tailwind v4, mobile-first, reuse Home's classes/components.
- **Testing**: Vitest + React Testing Library, colocated `*.test.tsx`/`*.test.ts`, following existing card/route test patterns.
- **Commits**: Conventional Commits; reference this spec's task IDs in bodies.

## Technical Considerations

- **Reuse over rebuild**: team match history already exists as `Match[]` via `teamScheduleForLeague`; the team path (Unit 2) is largely wiring plus a 10/10 cap. The heavy lifting is Unit 3 (players).
- **Player expansion is the main technical work**: `athleteSchedule` currently resolves only a single last/next as lightweight `EntityMatch`. This spec needs a path that returns **fully-populated `Match` objects** for up to ~20 of a player's matches. For **tennis players**, that means resolving each competition's per-player set scores, flags, seeds, and round/draw into `TennisMatchDetail` so `TennisMatchCard` renders identically to Home; for **team-sport players**, building complete `Match` objects (both sides, logos, scores).
- **Fan-out / performance**: expanding a player's schedule may require multiple ESPN core-API `$ref` fetches per match (potentially ~20 matches). Bound the work (cap at 10 recent + 10 upcoming *before* deep-resolving where possible), parallelize with `Promise.all`, and reuse the existing `revalidateSeconds` caching (completed results are immutable). Watch for latency; consider resolving only the capped set.
- **Selection logic**: "recent 10" = the 10 most recent `final` matches (most-recent first, then displayed oldest→newest in the chronological list); "next 10" = the 10 soonest `upcoming`. Reuse the sort-key approach in `extractEntityMatches`.
- **Scroll-to-recent**: the focus-on-most-recent-match behavior is a client concern (scroll the completed/upcoming boundary into view on mount); keep it resilient to layout shifts from lazy-loading images.
- **Deep-linkability**: the route is keyed by `favoriteId`; the detail page must re-resolve the favorite server-side (not rely on state passed from the Teams tab) so the URL works on direct load/refresh.
- **No new live polling** needed (see Non-Goals); a single fetch keeps the endpoint's fan-out cost bounded.

## Security Considerations

- **Authorization scoping**: the detail route and its endpoint must resolve `favoriteId` only among favorites owned by the authenticated user. A `favoriteId` belonging to another user (or unknown) must yield a not-found/empty state — never another user's data. Follow the existing auth-gate pattern (`auth()` + `listFavoritesForUser(session.user.id)`).
- **No new secrets**: this feature uses the same public ESPN endpoints already in use; no new credentials or tokens are introduced.
- **Proof artifacts**: screenshots should show only this app's UI with test/sample favorites; do not commit any real user session tokens or `.env.local`.
- No sensitive/PII data is handled beyond the existing favorites already stored for the user.

## Success Metrics

1. **Navigation works end-to-end**: tapping any team or player on Teams opens its detail screen, and the back button returns to Teams — verified for teams, team-sport players, and tennis players (100% of the three entity paths).
2. **Visual parity**: match cards on the detail screen are the same components as Home (`MatchCard` / `TennisMatchCard`) with no visual regression — verified by screenshot comparison and reuse (zero new card components).
3. **Data correctness**: for a seeded entity, the screen shows the correct ≤10 recent + ≤10 upcoming matches for that specific entity, ordered chronologically with the recent match in focus on load.
4. **Graceful degradation**: off-season/sparse and data-unavailable entities render friendly empty states with no crashes — verified by tests.
5. **Quality gates**: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and `pnpm test:ci` all pass in CI.

## Open Questions

1. **Player fan-out latency**: expanding a tennis player's schedule into full set-by-set `Match` objects may require many core-API round-trips. If this proves too slow even with caps + caching, is a slightly reduced tennis-player fidelity (or a small loading state / lower cap) acceptable as a fallback? (Non-blocking; can be tuned during implementation.)
2. **Re-fetch on tab focus**: should the detail screen inherit the "refetch on visibility change" behavior from Home/Teams, or is a single fetch on mount sufficient given no live polling? (Leaning single-fetch; trivially adjustable.)
