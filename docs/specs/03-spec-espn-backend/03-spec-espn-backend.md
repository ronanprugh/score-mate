# 03-spec-espn-backend.md

## Introduction/Overview

score-mate currently sources all sports data from TheSportsDB's free tier via `lib/sportsdb/client.ts`. The free tier is rate-limited, inconsistent across sports, and (per user direction) is being retired in favor of ESPN's unofficial public API (`site.api.espn.com` + `sports.core.api.espn.com`, as documented in [pseudo-r/Public-ESPN-API](https://github.com/pseudo-r/Public-ESPN-API)). This spec defines a complete hard-swap of the data backend: a new `lib/espn/` provider module that conforms to the existing internal `Match`/`Team`/`League`/`Sport` contract, a rewritten search route backed by committed team/league catalogs, an updated aggregator fan-out that matches ESPN's per-league shape, and a tiered cache. The internal types and all downstream UI components stay unchanged.

## Goals

1. Replace `lib/sportsdb/` with a new `lib/espn/` provider that satisfies the same `Fetchers` contract consumed by `lib/home/aggregator.ts` — zero changes required in `app/(app)/`, `components/`, `lib/home/aggregator.ts`, `lib/favorite-matcher.ts`, or `lib/events-catalog.ts` beyond league-id remapping.
2. Drop Tennis from the supported-sports set; keep Soccer, American Football, Basketball with expanded league coverage.
3. Reset all user favorites (no production users yet) and re-curate the events catalog with ESPN league ids.
4. Land a deterministic, build-time team/league catalog so the favorites typeahead doesn't depend on a runtime upstream search endpoint.
5. Ship a tiered cache (short TTL for today, longer for yesterday/tomorrow) that produces near-live scores for in-progress games.

## User Stories

- **As a signed-in user**, I want my homepage's yesterday/today/tomorrow match list to be sourced from ESPN so that scores update faster and league coverage is more reliable.
- **As a signed-in user**, I want to search for and favorite teams and leagues from ESPN's catalogs (NFL, NCAA football, NBA, WNBA, NCAA basketball, top global soccer leagues) so that my favorites reflect leagues I actually watch.
- **As a signed-in user**, I want live scores on the homepage to reflect actual in-game state within ~30 seconds so that I can use score-mate as a quick at-a-glance scoreboard.
- **As the score-mate maintainer**, I want zero references to `thesportsdb.com` or `lib/sportsdb/` left in the codebase after this change so that the provider swap is unambiguous and easy to reason about.

## Demoable Units of Work

### Unit 1: ESPN provider module + supported-sports update

**Purpose:** Stand up a new `lib/espn/` module that returns the same internal `Match`/`Team`/`League` shapes the rest of the app already consumes, and update `Sport`/`SUPPORTED_SPORTS` to drop Tennis.

**Functional Requirements:**
- The system shall expose `lib/espn/client.ts` with functions equivalent to today's `lib/sportsdb/client.ts` public surface: `scoreboardForLeague(leagueKey, date)`, `teamScheduleForLeague(leagueKey, teamId)`, `leagueTeams(leagueKey)`, and helpers to discover all league keys for a given `Sport`.
- The system shall keep `lib/sportsdb/types.ts` (renamed to `lib/sports/types.ts` or kept in place — see Technical Considerations) and its `Match`/`Team`/`League`/`EventInstance`/`Favorite` shapes byte-compatible with today's, except that `Sport` shall be `"Soccer" | "American Football" | "Basketball"` (Tennis removed).
- The system shall map ESPN's status strings (`STATUS_FINAL`, `STATUS_IN_PROGRESS`, `STATUS_SCHEDULED`, etc.) to the existing `MatchStatus` (`final` | `live` | `upcoming`) such that `aggregator.test.ts`, `favorite-matcher.test.ts`, and `match-card.test.tsx` pass without behavioral edits beyond fixture swaps.
- The system shall hit `site.api.espn.com` for scoreboard/teams/schedule calls and shall use `sports.core.api.espn.com` only as a fallback for fields missing from the site response (e.g. venue or broadcast detail when absent on a given event), with the fallback gated behind a per-field needed-only check so the homepage hot path remains one round-trip per (league, date).
- The system shall parse ESPN's `date` field (ISO 8601 with `Z`) directly into `kickoffUtc` without the `Z`-suffix workaround currently needed for TheSportsDB.
- The system shall remove `lib/sportsdb/` entirely (client, types, fixtures, tests) once the new module's tests pass.

**Proof Artifacts:**
- Test: `pnpm test:ci` passes with new `lib/espn/client.test.ts` (using recorded ESPN response fixtures under `lib/espn/__fixtures__/`) and the existing aggregator/matcher/route tests green against the new client.
- Diff: `git diff main -- lib/` shows `lib/sportsdb/` removed and `lib/espn/` added, and shows `Sport` updated.
- Grep: `grep -r "thesportsdb\|sportsdb" --include="*.ts" --include="*.tsx"` returns no matches outside `docs/`.

### Unit 2: League coverage + events catalog remap

**Purpose:** Wire the aggregator to fan out across ESPN's per-league scoreboard endpoints and remap the hand-curated events catalog to ESPN league keys.

**Functional Requirements:**
- The system shall define a `SUPPORTED_LEAGUES` constant in `lib/espn/` listing every (sport, leagueKey, displayName) triple v1 supports:
  - American Football: `football/nfl`, `football/college-football`.
  - Basketball: `basketball/nba`, `basketball/wnba`, `basketball/mens-college-basketball`.
  - Soccer (default v1 set, subject to trimming per Open Questions §1): `soccer/eng.1`, `soccer/esp.1`, `soccer/ita.1`, `soccer/ger.1`, `soccer/fra.1`, `soccer/usa.1`, `soccer/uefa.champions`, `soccer/uefa.europa`, `soccer/uefa.europa.conf`, `soccer/fifa.world`, `soccer/conmebol.libertadores`, `soccer/concacaf.champions`, `soccer/eng.fa`, `soccer/eng.league_cup`.
- The system shall update `lib/home/aggregator.ts` so that for each favorited `Sport`, it fans out one scoreboard call per (leagueKey ∈ that sport, date ∈ widened 5-date window) instead of one per (sport, date).
- The system shall update `lib/events-catalog.ts` entries' `leagueId` field to ESPN league keys (e.g. `"soccer/fifa.world"` for the World Cup) and remove any `leagueNameContains` fallbacks that are no longer needed.
- The system shall preserve the existing local-date bucketing, dedup-by-id, and partial-failure behavior of the aggregator — only the fan-out inputs change.

**Proof Artifacts:**
- Test: `aggregator.test.ts` passes with the new fan-out (covering: per-league call count, bucketing across UTC↔local boundary, partial-failure `source.errors` propagation).
- CLI: `curl -H "Cookie: ..." 'http://localhost:3000/api/home?dates=YYYY-MM-DD,YYYY-MM-DD,YYYY-MM-DD&tz=America/New_York'` returns an envelope whose matches' `leagueId` values are ESPN league keys.
- Screenshot: homepage rendered against a live dev server showing matches from at least two leagues across two of the three day buckets, with kickoff times in local timezone.

### Unit 3: Snapshot team/league catalog + new search route

**Purpose:** Replace the runtime TheSportsDB search calls with a committed JSON catalog of all teams/leagues across the supported leagues, served via an in-memory substring matcher.

**Functional Requirements:**
- The system shall provide `scripts/refresh-espn-catalog.ts`, an operational script that fetches `/{leagueKey}/teams` for every entry in `SUPPORTED_LEAGUES` and writes a single sorted JSON file at `lib/espn/catalog.json` containing `{ teams: Team[], leagues: League[] }`.
- The system shall commit the generated `lib/espn/catalog.json` to the repo. The script shall be idempotent and the JSON shall be sorted deterministically (by `sport`, then `leagueKey`, then `id`).
- The system shall rewrite `app/api/favorites/search/route.ts` to substring-match the query against `catalog.json` in memory (plus the existing `events-catalog` and sport-name matching), returning the same `{ type, externalId, displayName, sport, metadata? }` shape the client already consumes.
- The system shall continue to cap each result category at 10 entries and to return categories in the existing order (sport, event, league, team).
- The system shall add a unit test verifying the search route returns ESPN-sourced teams/leagues for known queries (e.g. `?q=arsenal` returns `Arsenal FC`; `?q=lakers` returns `Los Angeles Lakers`).

**Proof Artifacts:**
- File: `lib/espn/catalog.json` committed with > 500 teams across the supported leagues; team counts per league recorded in `docs/specs/03-spec-espn-backend/03-proofs/`.
- Test: `app/api/favorites/search/route.test.ts` covers the new in-memory search.
- Screenshot: Favorites screen typeahead showing ESPN team and league results for at least one query per sport.

### Unit 4: Tiered cache + favorites reset migration

**Purpose:** Ship a per-bucket cache TTL that produces near-live scores and provide a one-shot migration that truncates the existing `favorites` table (no production users; per Q4 answer (D)).

**Functional Requirements:**
- The system shall update `lib/home/cache.ts` so that the per-(league,date) scoreboard cache uses:
  - 30s TTL when the date equals the user-supplied `today`.
  - 5m TTL when the date equals `tomorrow` (or its widened ±1 neighbor).
  - 1h TTL when the date equals `yesterday` (or its widened ±1 neighbor).
- The system shall use cache key prefix `v3-espn` to invalidate all existing `v2-utc` keys on deploy.
- The system shall provide a Drizzle migration that `TRUNCATE`s the `favorites` table (no schema change — the `external_id` column continues to hold opaque strings, now ESPN ids).
- The system shall add a one-line release note in `README.md` documenting that the provider swap reset favorites.

**Proof Artifacts:**
- Test: `lib/home/cache.test.ts` (new) verifies the TTL is selected correctly per (date vs. dates window) input.
- File: `db/migrations/NNNN_reset_favorites_for_espn.sql` committed.
- Screenshot: homepage with a live in-progress game showing the score updating within ~30s of the upstream change (manual verification note in proofs file).

## Non-Goals (Out of Scope)

1. **Tennis support.** ESPN's tennis API is per-tournament and does not fit the league-scoreboard model. Tennis is removed from `SUPPORTED_SPORTS` for v1; a future spec can reintroduce it as a separate per-tournament pipeline.
2. **Dual-provider fallback.** No runtime switching between ESPN and TheSportsDB. The old client is deleted.
3. **Migrating existing favorites by id translation.** Per Q4 answer (D), all existing favorite rows are truncated; users re-favorite from the new search.
4. **A managed ESPN API key or paid tier.** v1 relies solely on the unauthenticated public endpoints; if ESPN ever rate-limits us, that's a follow-up spec.
5. **Backfill of historical matches older than `yesterday`.** The homepage's three-day window is unchanged.
6. **A new UI for picking sports/leagues hierarchically.** The existing typeahead is retained, only its data source changes.
7. **Server-Sent Events / WebSocket live updates.** Tiered cache + client polling is the only freshness mechanism.
8. **A separate read-through cache layer (Redis, etc.).** Continue using Next.js `unstable_cache` as today.

## Design Considerations

No new UI surfaces, no design mockups required. The Favorites typeahead, homepage match list, and match cards all continue to render the existing `Match`/`Team`/`League` shapes. The only user-visible UX changes are:

- Tennis disappears from the search results and any tennis favorites disappear from the homepage (because their rows are truncated in Unit 4).
- Today's live scores update visibly faster (≤ ~30s lag instead of the prior several-minute lag).
- Search results may show slightly different display names (ESPN's canonical naming differs from TheSportsDB's, e.g. "Manchester United" vs "Man United").

The "data source error" banner (`components/data-source-error-banner.tsx`) continues to render when `source.ok === false`; no copy change required.

## Repository Standards

Follows the existing conventions in [AGENTS.md](../../../AGENTS.md):

- Next.js 16 App Router; server-only modules under `lib/`; route handlers under `app/api/`.
- TypeScript strict, no `any`, no `@ts-ignore` without tracked TODO.
- Drizzle ORM for the favorites-reset migration; committed SQL under `db/migrations/`.
- Vitest + RTL colocated tests; `pnpm test:ci`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check` must pass in CI.
- Conventional Commits; reference the relevant SDD task in each commit body.
- New fixtures under `lib/espn/__fixtures__/` mirror the structure of the existing `lib/sportsdb/__fixtures__/`.

## Technical Considerations

- **Module rename.** `lib/sportsdb/types.ts` is consumed by `db/schema/favorites.ts`, `lib/favorite-matcher.ts`, `lib/events-catalog.ts`, and many components. To keep the diff small and avoid a sweeping rename, **move the types file to `lib/sports/types.ts`** (provider-neutral name) and update all imports. The new ESPN client lives at `lib/espn/client.ts` and imports from `@/lib/sports/types`. This makes the provider-agnostic intent explicit in the file tree.
- **Endpoint entry points (per Q2 (B)).**
  - Hot path (homepage): `GET https://site.api.espn.com/apis/site/v2/sports/{leagueKey}/scoreboard?dates=YYYYMMDD` — one call per (leagueKey, date) in the widened 5-date window.
  - Catalog build (offline script): `GET https://site.api.espn.com/apis/site/v2/sports/{leagueKey}/teams` — one call per leagueKey.
  - Fallback (only when a needed field is missing on a site v2 event): the matching event's `$ref` link into `sports.core.api.espn.com`. Implemented as an opt-in helper, not the default path.
- **Sport mapping.** ESPN's URL `{sport}` segment maps to internal `Sport` as: `football` → `"American Football"`, `basketball` → `"Basketball"`, `soccer` → `"Soccer"`. Tennis (`tennis/*`) is excluded.
- **Status mapping.** ESPN's `event.status.type.state` is one of `pre` | `in` | `post`. Map `pre` → `upcoming`, `in` → `live`, `post` → `final`. For `live`, `event.status.type.shortDetail` (e.g. `"Q3 8:21"`, `"73'"`, `"Halftime"`) populates `liveProgress`.
- **External id format.** Use ESPN's numeric `event.id` for matches, `team.id` for teams, and `leagueKey` (e.g. `"soccer/eng.1"`) for leagues. These become the new values of `favorites.external_id`.
- **Cache key strategy.** Bump the prefix to `v3-espn-{leagueKey}-{date}`. Tier TTL by comparing the call's `date` argument to the request's `today`/`yesterday`/`tomorrow` so the cache layer can pick the right `revalidate` value.
- **Catalog refresh cadence.** The script is operator-run (manual); document a quarterly refresh suggestion in `scripts/refresh-espn-catalog.ts`'s header comment. CI does not auto-refresh.
- **Robots / ToS posture.** The ESPN endpoints are unauthenticated, undocumented, and may change without notice. Treat all client functions as best-effort and surface upstream failures via the existing `source.errors` envelope rather than throwing. Do not commit any ESPN auth tokens, headers, or user-agent fingerprints intended to bypass throttling.
- **No new dependencies.** All HTTP calls go through `fetch`. No new SDK.

## Security Considerations

- No new secrets: ESPN public endpoints are unauthenticated.
- The catalog refresh script must not be reachable as a route handler — keep it under `scripts/` and require it be run manually via `pnpm tsx scripts/refresh-espn-catalog.ts`.
- The committed `lib/espn/catalog.json` contains only public team and league names/ids — no PII, no proprietary content beyond what ESPN's public scoreboard already exposes.
- The `favorites` truncation migration removes user data; gate it behind the standard `pnpm db:migrate` flow and call it out in the release note so it isn't run accidentally in any future production-data context.
- Continue to auth-gate `/api/home` and `/api/favorites/search` exactly as today.

## Success Metrics

1. **Provider purity:** `grep -r "thesportsdb\|sportsdb" --include="*.ts" --include="*.tsx"` returns zero matches outside `docs/`.
2. **Test parity:** 100% of pre-existing tests pass (excluding `lib/sportsdb/client.test.ts`, which is deleted with the module); all new tests (`lib/espn/client.test.ts`, `lib/home/cache.test.ts`, expanded `app/api/favorites/search/route.test.ts`) pass.
3. **Live-score freshness:** Manual observation — an in-progress game's score on the homepage updates within ≤ 30s of the change in ESPN's source data.
4. **League breadth:** The Favorites typeahead returns ≥ 1 result for each of: `arsenal`, `lakers`, `chiefs`, `manchester`, `liverpool`, `barcelona`, `wnba`, `mls`.
5. **CI green:** All `.github/workflows/ci.yml` jobs pass on the PR.

## Open Questions

1. **Soccer league trim.** The default `SUPPORTED_LEAGUES` includes 14 soccer competitions, which inflates the aggregator fan-out (up to 14 leagues × 5 dates = 70 calls per request when a user has any soccer favorite). Confirm or trim to a smaller set before Unit 2 lands. A conservative trim back to the "big five + MLS + UEFA Champions + UEFA Europa + FIFA World" (9 leagues) keeps coverage broad while cutting fan-out by ~35%.
2. **`leagueNameContains` removal.** Once all events-catalog entries carry stable ESPN `leagueKey`s, the `leagueNameContains` fallback in `lib/sports/types.ts > EventInstance` and `lib/favorites/validators.ts` may be unused. Decide in Unit 2 whether to delete it or leave it as a safety net.
3. **Cache TTL for live-state transitions.** A 30s TTL on "today" means a game that flips from `live` → `final` may be misrepresented for up to 30 seconds. Confirm that's acceptable, or shorten to 10s with the corresponding ESPN-call-volume tradeoff.
