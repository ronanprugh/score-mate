# 04-spec-tennis-and-baseball.md

> **Naming note:** the directory is `04-spec-tennis-and-baseball` because the original request mentioned both sports. Per Q1 (A), **this spec ships baseball only**. Tennis is deferred to a separate Spec 05 with its own per-tournament ingestion design.

## Introduction/Overview

Spec 03 swapped the data backend to ESPN with three supported sports: Soccer, American Football, and Basketball. ESPN's baseball API (`baseball/mlb`, `baseball/college-baseball`) follows the exact same per-league scoreboard shape, so adding Baseball is a near-mechanical extension of the `SUPPORTED_LEAGUES` registry, the `Sport` union, the sport allowlist, and the committed team catalog. This spec adds Baseball with MLB + NCAA D-I coverage; no aggregator, cache, route handler, or UI changes are required.

## Goals

- Add `"Baseball"` to the `Sport` union and `SUPPORTED_SPORTS` so favorites, search, and the aggregator all recognize it.
- Add MLB (`baseball/mlb`) and NCAA D-I (`baseball/college-baseball`) to `SUPPORTED_LEAGUES`.
- Refresh `lib/espn/catalog.json` so MLB and NCAA D-I teams appear in the favorites typeahead.
- Update `SPORT_ALLOWLIST` with a curated Baseball entry list (MLB regular season + College World Series).
- Bump the homepage cache prefix so existing cached `planLeagueKeys` results don't suppress baseball games for the first hour after deploy.

## User Stories

- **As a baseball fan**, I want to favorite my MLB team so that today's, yesterday's, and tomorrow's MLB games show up on the homepage alongside my other sports.
- **As a college baseball fan**, I want to favorite a College World Series contender so that NCAA D-I baseball matches appear during the season.
- **As a "follow the whole sport" user**, I want to favorite Baseball as a sport so that marquee baseball matches (MLB regular season + College World Series) surface without me having to add individual team favorites.
- **As the maintainer**, I want the swap to be a small, reviewable diff that doesn't touch the aggregator, cache layer, or any UI component.

## Demoable Units of Work

### Unit 1: Sport / league / allowlist additions

**Purpose:** Teach the type system and the league registry that Baseball exists, so a Baseball favorite would route correctly even before the catalog is refreshed.

**Functional Requirements:**

- The system shall extend the `Sport` union in `lib/sports/types.ts` to include `"Baseball"`, and add `"Baseball"` to `SUPPORTED_SPORTS`.
- The system shall add a `baseball` → `"Baseball"` entry to `SPORT_FROM_SEGMENT` in `lib/espn/client.ts` so `sportFromLeagueKey("baseball/mlb")` returns `"Baseball"`.
- The system shall add two entries to `SUPPORTED_LEAGUES` in `lib/espn/leagues.ts`: `{ leagueKey: "baseball/mlb", sport: "Baseball", displayName: "MLB" }` and `{ leagueKey: "baseball/college-baseball", sport: "Baseball", displayName: "NCAA Baseball" }`.
- The system shall add a `Baseball` key to `SPORT_ALLOWLIST` in `lib/sport-allowlist.ts` with at least: `baseball/mlb` (MLB) and a `leagueNameContains: "College World Series"` entry for the marquee NCAA tournament.
- The system shall add `"Baseball"` to the accepted-sports set in `lib/favorites/validators.ts` (whose Zod schema is currently driven by `SUPPORTED_SPORTS`) so POST `/api/favorites` accepts baseball favorites.
- The system shall update fixture cases that enumerate every sport (e.g. `lib/favorites/validators.test.ts`, `lib/sport-allowlist.test.ts`) to include Baseball.

**Proof Artifacts:**

- Test: `pnpm test:ci` passes; new assertions in `lib/espn/leagues.test.ts` cover `leagueKeysForSport("Baseball").length === 2`, `findSupportedLeague("baseball/mlb")` returns the entry, and the existing "no Tennis" assertion stays green.
- Test: `lib/espn/client.test.ts` covers `sportFromLeagueKey("baseball/mlb") === "Baseball"` and `sportFromLeagueKey("baseball/college-baseball") === "Baseball"`.
- Test: `lib/sport-allowlist.test.ts` adds Baseball positive (`baseball/mlb` ↔ "MLB") and negative (NPB Japan league) cases.
- CLI: `pnpm typecheck` clean — confirms the new `Sport` value propagates through every consumer (favorites schema, aggregator, components) with no `any` escape hatches.

### Unit 2: Catalog refresh + cache bump

**Purpose:** Make baseball teams appear in the favorites typeahead and ensure the homepage's first request after deploy actually fans out to baseball league scoreboards.

**Functional Requirements:**

- The system shall regenerate `lib/espn/catalog.json` via `pnpm tsx scripts/refresh-espn-catalog.ts` so it includes all 30 MLB teams plus ESPN's NCAA D-I baseball team list, and commit the refreshed JSON.
- The system shall bump `CACHE_KEY_PREFIX` in `lib/home/cache.ts` from `v5-espn-shortname` to `v6-espn-baseball` so cached `scoreboardForLeague` results from before the baseball-aware deploy are invalidated (otherwise a user who already had cached Soccer/Basketball/Football results would not see baseball games until the longest TTL — 1 hour — expired).
- The system shall update `lib/home/cache.test.ts` to assert the new prefix value.
- The system shall update `README.md` under **Operations → Release notes** with a one-line entry referencing this spec.
- The system shall NOT modify `lib/home/aggregator.ts`, `lib/home/cache.ts` (beyond the prefix bump), `app/api/home/route.ts`, `app/api/favorites/search/route.ts`, or any component under `components/` — the existing code paths already handle a new sport correctly once the registry knows about it.

**Proof Artifacts:**

- File: `lib/espn/catalog.json` committed; `jq '.teams | map(select(.sport == "Baseball")) | length' lib/espn/catalog.json` returns ≥ 30 (MLB) and ≥ 250 (NCAA D-I, rough lower bound — exact count recorded in proofs).
- File: `lib/espn/catalog.json` committed; `jq '[.teams[] | .sport] | unique' lib/espn/catalog.json` lists exactly `["American Football", "Baseball", "Basketball", "Soccer"]`.
- CLI: Updated breadth check (`scripts`-style node one-liner against `catalog.json`) — queries `yankees`, `dodgers`, `orioles` each return ≥ 1 team result; saved to `04-proofs/01-breadth.txt`.
- CLI: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build` all exit 0; transcript saved to `04-proofs/01-ci-gates.txt`.
- CLI: `curl -sS -H "Cookie: ..." 'http://localhost:3000/api/favorites/search?q=yankees'` returns ≥ 1 result with `sport: "Baseball"` and `externalId` matching ESPN's Yankees team id. (Deferred to user — recipe documented.)
- Screenshot: Favorites typeahead in the dev server showing at least one MLB team result. (Deferred to user.)
- Screenshot: Homepage with a seeded MLB favorite during the season showing a baseball match in one of the three day buckets. (Deferred to user — only producible while MLB is in season.)

## Non-Goals (Out of Scope)

1. **Tennis.** Per Q1 (A), tennis is its own Spec 05 with a per-tournament ingestion pipeline.
2. **Minor-league baseball.** ESPN coverage of the minors is uneven; revisit if there's explicit demand.
3. **Mexican League (LMB), KBO, NPB, or other international baseball.** Same rationale.
4. **A "Series" or "playoff bracket" UI.** The MLB postseason and College World Series surface as normal matches; no bracket visualization.
5. **Player favorites for baseball** (e.g. favoriting Aaron Judge). Not a v1 favorite type; reuses the broader player-favorite design pending Spec 05.
6. **Any UI / component changes.** The match card, day tabs, league grouping, and typeahead already handle an additional sport with no edits.
7. **A new aggregator fan-out path.** The existing per-(leagueKey, date) loop in `lib/home/aggregator.ts` covers baseball as soon as the registry adds the keys.

## Design Considerations

No new design surfaces. The existing match card (post-Spec 03 cleanup with stacked city/mascot, team logos, dim-the-loser) already accommodates a fourth sport without changes. Notable visual observations:

- MLB team display names are city + nickname (`Kansas City Royals`, `Los Angeles Dodgers`), and `shortDisplayName` is the nickname (`Royals`, `Dodgers`) — the existing `splitTeamName` heuristic in `MatchCard` will stack them correctly.
- NCAA baseball team names often include a state or campus prefix (`LSU Tigers`, `Stanford Cardinal`); same heuristic handles these.
- ESPN returns team logos on baseball events (verified via the probe in the questions file's intro) — logos render via the existing `homeTeamLogo` / `awayTeamLogo` flow.

## Repository Standards

Follows the established conventions documented in [AGENTS.md](../../../AGENTS.md):

- Next.js 16 App Router; TS strict; no new `any`; no `@ts-ignore`.
- Drizzle migrations live under `db/migrations/`. **This spec adds no migration** — `favorites.sport` is a free-text column, so adding a value to the `Sport` union is a code-only change.
- Vitest + RTL; colocated `*.test.ts(x)`; CI runs `lint → format:check → typecheck → test:ci → build`.
- Conventional Commits, with `Related to T#.# in Spec 04-spec-tennis-and-baseball` in the body.
- No new runtime dependencies; HTTP via `fetch`; `tsx` runs the catalog refresh script.

## Technical Considerations

- **Add the `baseball` sport segment to the existing `SPORT_FROM_SEGMENT` map** in `lib/espn/client.ts`. This is the only place the `{sport}` URL segment is decoded into our internal `Sport` enum.
- **No aggregator changes needed.** `planLeagueKeys` already does `for (const sport of sports) for (const key of leagueKeysForSport(sport)) keys.add(key)` — adding baseball league keys to the registry is enough.
- **No cache layer changes** beyond the prefix bump in Unit 2. The tiered TTL (`chooseRevalidate`) is sport-agnostic.
- **No route-handler changes.** `/api/home` calls `aggregateMatchesForUser` with `makeCachedFetchers(dates)`; both already work for any league key. `/api/favorites/search` substring-matches the committed catalog — adding rows is enough.
- **Cache prefix rationale (Unit 2):** the cache stores parsed `Match[]` per `(leagueKey, date)`. Soccer/Basketball/Football cached entries pre-deploy don't include baseball, but a user with an existing Baseball favorite would still see correct results once those keys cache-miss. The bump is defensive — it guarantees the first post-deploy request sees the new fan-out plan applied to fresh data, which matches the precedent we set in Spec 03 (each release that changes parsed-data shape bumps the prefix).
- **NCAA team count.** The refresh script will pull whatever ESPN returns; expect ~290 NCAA D-I baseball teams. We commit them all (the catalog is flat per Q5 (A)).
- **NCAA name fallback.** `lib/sport-allowlist.ts` should include a `leagueId: "baseball/college-baseball"` entry plus a `leagueNameContains: "College World Series"` entry for the marquee postseason — same pattern used today for "March Madness" inside `basketball/mens-college-basketball`.

## Security Considerations

No new secrets. ESPN's baseball endpoints are unauthenticated, same as every other sport. The committed catalog contains only public team metadata (id, displayName, shortDisplayName, optional logo URL).

## Success Metrics

1. **Type-system coverage:** `Sport` includes `"Baseball"`; `pnpm typecheck` clean with no exhaustiveness regressions.
2. **Registry coverage:** `SUPPORTED_LEAGUES` contains `baseball/mlb` and `baseball/college-baseball`; `leagueKeysForSport("Baseball").length === 2`.
3. **Catalog coverage:** `jq '.teams | map(select(.sport == "Baseball")) | length' lib/espn/catalog.json` ≥ 250.
4. **Search breadth:** queries `yankees`, `dodgers`, `orioles` each return ≥ 1 team result from `/api/favorites/search`.
5. **CI green:** all five gates pass on the PR.
6. **No collateral edits:** `git diff` for the merge excludes `lib/home/aggregator.ts`, `app/api/home/route.ts`, `app/api/favorites/search/route.ts`, and `components/**`.

## Open Questions

1. **Should the events-catalog gain a 2026 World Series entry?** Today's events catalog covers FIFA World Cup, Super Bowl, NCAA Tournament. The MLB World Series would fit naturally, but the date window isn't known until October. Defer to a small follow-up edit (zero code changes — just add one row to `lib/events-catalog.ts`) once the schedule is firm.
2. **Should `SPORT_ALLOWLIST.Baseball` include the All-Star Game?** The MLB All-Star Game is a single-day event inside `baseball/mlb`, similar to the Super Bowl inside `football/nfl`. Decide during implementation; happy to add a `leagueNameContains: "All-Star"` entry if desired.
3. **NCAA baseball season window.** NCAA D-I baseball runs roughly February through June (with the College World Series in mid-June). Out-of-season, fan-out calls return zero events but still consume an HTTP round-trip per (leagueKey, date) = 5 calls per request. Same behavior as football out-of-season today; acceptable.
