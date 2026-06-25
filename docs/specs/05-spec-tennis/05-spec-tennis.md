# 05-spec-tennis.md

## Introduction/Overview

Tennis is currently the only major sport `score-mate` ignores, because ESPN's tennis API is per-tournament rather than per-league and doesn't fit the `SUPPORTED_LEAGUES` registry pattern that Soccer, American Football, Basketball, and Baseball use. This spec adds Tennis to the homepage by introducing a **tournament-level card** primitive: while a Slam or ATP/WTA 1000 is in progress, the homepage shows one card per active tournament with live status, and tapping a card expands it inline to a list of today's matches (rendered with the existing `MatchCard`, extended to support player-vs-player). Coverage is restricted to marquee tournaments (Grand Slams + ATP/WTA 1000s) so the long tail of low-interest 250-level events doesn't bloat the feed.

## Goals

- Add `"Tennis"` to the supported `Sport` set with a marquee-tournament ingestion path that fits alongside Spec 03/04's per-league fetchers.
- Introduce a tournament-level card on the homepage that shows tournament name, dates, current round, and a live/upcoming/done match-count summary while a tournament is active.
- Allow users to favorite a tennis tournament (e.g. "Wimbledon") with a stable, year-less identifier so the favorite carries across editions.
- Reuse the existing `MatchCard` for the expanded per-match rows so tennis matches look visually consistent with the rest of the homepage.
- Keep new endpoint pressure proportional to a tournament's active window — no daily fan-out to dormant scoreboards.

## User Stories

- **As a Grand Slam fan**, I want Wimbledon to appear on my homepage automatically while it's running so I can see at a glance how far through the tournament we are and what's live right now.
- **As a tennis follower**, I want to favorite "Wimbledon" once and have that favorite carry forward to next year's edition without re-favoriting.
- **As a casual fan**, I want to tap a tournament card and see today's matches inline without leaving the homepage.
- **As the maintainer**, I want tennis ingestion to only call ESPN for tournaments that are actually in progress, so the homepage's daily fan-out doesn't blow up.
- **As the maintainer**, I want tennis's "scoreboard for one tournament-day" shape to plug into the existing per-day cache and aggregator, not require a parallel runtime path.

## Demoable Units of Work

### Unit 1: Tennis sport scaffolding + marquee tournament registry

**Purpose:** Teach the type system, the ESPN client, and the favorites validator that Tennis exists, and ship the hardcoded list of marquee tournaments that v1 tracks.

**Functional Requirements:**

- The system shall add `"Tennis"` to the `Sport` union and `SUPPORTED_SPORTS` in `lib/sports/types.ts`.
- The system shall add a `tennis` → `"Tennis"` entry to `SPORT_FROM_SEGMENT` in `lib/espn/client.ts` so `sportFromLeagueKey("tennis/atp/wimbledon")` resolves.
- The system shall define a `MARQUEE_TENNIS_TOURNAMENTS` registry in `lib/espn/tennis.ts` containing every marquee tournament v1 supports. Each entry shall have a stable, year-less identifier (e.g. `tennis/atp/wimbledon`), a `tour` value (`"ATP" | "WTA" | "Slam"`), a `displayName`, and the ESPN scoreboard URL template.
- The marquee set shall include: the four Grand Slams (Australian Open, Roland Garros, Wimbledon, US Open) and the nine ATP 1000 + ten WTA 1000 events that are listed in the ATP/WTA 2026 calendar at the time of implementation. The exact list shall be captured in code with a comment linking to the ATP/WTA calendar source URL.
- The system shall add a `Tennis` block to `SUPPORTED_SPORTS`-driven downstream artifacts where each sport is enumerated (e.g. `lib/favorites/validators.test.ts` accept set, `lib/sport-allowlist.test.ts` coverage loop). Per Q8 (A) there is **no** entry in `SPORT_ALLOWLIST` — the marquee registry IS the allowlist.
- The system shall add a `tennisScoreboard(tournamentId, date)` function to the ESPN client that returns a normalized list of `Match`-shaped records for that tournament on that date (or an empty list when the tournament isn't currently in session).
- The favorites validator shall accept `{ type: "event", sport: "Tennis", externalId: <year-less id> }` payloads so users can favorite a tournament.

**Proof Artifacts:**

- Test: `pnpm test:ci` passes; `lib/espn/tennis.test.ts` asserts the marquee registry has exactly **23** entries (4 Slams + 9 ATP 1000s + 10 WTA 1000s) and that every entry's `id` matches the `tennis/{tour}/{slug}` shape.
- Test: `lib/espn/client.test.ts` covers `sportFromLeagueKey("tennis/atp/wimbledon") === "Tennis"`.
- Test: `lib/favorites/validators.test.ts` accepts a `Tennis` `event` favorite and continues to reject unsupported sports.
- CLI: `pnpm typecheck` clean.

### Unit 2: Active-tournament discovery, caching, and tournament-card UI

**Purpose:** Surface today's active marquee tournaments on the homepage as collapsed tournament cards with the live/upcoming/done summary.

**Functional Requirements:**

- The system shall add `getActiveTennisTournaments(today)` to `lib/home/tennis-aggregator.ts` (new file). The function shall iterate `MARQUEE_TENNIS_TOURNAMENTS`, call `tennisScoreboard(id, today)`, and return only those tournaments where the returned match list is non-empty (Q6 (C) hybrid: registry-driven, date-range from ESPN response).
- The returned `ActiveTournament` shape shall include: stable `id`, `displayName`, `tour`, `startDate`, `endDate`, `currentRound` (parsed from ESPN's `round` field on today's matches), `liveCount`, `upcomingCount`, `doneCount`, and the raw `matches: Match[]` for the expand-on-tap interaction.
- The "today" used for the counts shall be the user's local date — the same `DateWindow.today` the existing aggregator already uses (Q4 (A)).
- The system shall add a `cachedActiveTennisTournaments(today)` cache layer wrapping `getActiveTennisTournaments` with a 1-hour `revalidate` TTL (Q7 (B)/(C)). The cache key shall include `CACHE_KEY_PREFIX`, the literal `"tennis-active"`, and the date.
- The system shall bump `CACHE_KEY_PREFIX` in `lib/home/cache.ts` from `"v6-espn-baseball"` to `"v7-espn-tennis"` so the deploy invalidates prior cached planning results that pre-date tennis support.
- The system shall add a new `TournamentCard` component in `components/tournament-card.tsx` that renders, in collapsed state: tournament `displayName`, date range (e.g. "Jun 29 – Jul 12"), `currentRound`, and a single line "N live · M upcoming · K done" using the three counts.
- The homepage aggregator output shall include an `activeTennisTournaments` field that the homepage renders **mixed with** existing match cards. Sort key per Q3 (B): tournament cards are ordered using the earliest `kickoffUtc` among their `live + upcoming` matches; if no live/upcoming match remains today, the tournament card sorts to the bottom of the day's feed.
- Touch target: the collapsed card shall meet the repo's ≥44×44 px minimum (`min-h-11` or larger).

**Proof Artifacts:**

- Test: `lib/home/tennis-aggregator.test.ts` asserts that when 3 of 23 marquee tournaments return non-empty scoreboards for `today`, only those 3 appear in the result and that `liveCount`/`upcomingCount`/`doneCount` match the input fixture.
- Test: `lib/home/cache.test.ts` asserts `CACHE_KEY_PREFIX === "v7-espn-tennis"`.
- Test: `components/tournament-card.test.tsx` renders a sample collapsed card and asserts the "N live · M upcoming · K done" line, date range, and round are present and that the card root meets the 44px minimum.
- Test: an aggregator test that mixes match data and tennis data verifies the sort key places a tournament card at the position of its earliest live/upcoming `kickoffUtc`.
- Screenshot: `docs/specs/05-spec-tennis/05-proofs/05-tournament-card.png` showing the collapsed card on the homepage during an active Slam.

### Unit 3: Expand-to-show-matches + tennis catalog + favorites typeahead

**Purpose:** Make tournament cards interactive (tap to expand to today's matches using the existing `MatchCard`), and make the tournaments favoritable from the search screen.

**Functional Requirements:**

- The `TournamentCard` component shall be expandable: tapping the collapsed card transitions it to an expanded state that renders one `<MatchCard>` per match in the tournament's `matches` array, in chronological order.
- The card shall preserve the open/closed state in component-local React state. Multiple tournament cards may be expanded simultaneously. State does not need to persist across navigation.
- The system shall extend `MatchCard` and the underlying `Match` shape to render a **player-vs-player** match. Per Q5 Round 2 (B), names are rendered **full** (e.g. "Carlos Alcaraz" / "Jannik Sinner"). When `Match` has no `homeTeamLogo` / `awayTeamLogo` (the tennis case), the card shall render without a logo placeholder slot and shall NOT attempt to call `splitTeamName` (since `displayName` is already the player's full name).
- The system shall add the 23 marquee tournaments to the favorites typeahead catalog (`lib/espn/catalog.json`) as `type: "league"` entries with `sport: "Tennis"` and the stable year-less `id` as `leagueKey`. (Even though tournaments are favorited as `type: "event"`, the catalog reuses the `league` slot since the typeahead UI already groups by Team / League / Sport / Event — exposing them as "League" matches the existing typeahead behavior with minimal new code. The favorite written to the DB still has `type: "event"` per Q3 Round 1 (B).)
- The favorites search route handler shall translate a user-selected tennis-tournament catalog entry into a POST body with `type: "event"`, `sport: "Tennis"`, and `externalId` equal to the year-less id.
- The system shall append a release note to `README.md` under **Operations → Release notes** that references Spec 05 and identifies `CACHE_KEY_PREFIX` `v7-espn-tennis` as the deploy invalidation mechanism.

**Proof Artifacts:**

- Test: `components/tournament-card.test.tsx` covers the expand toggle (click → matches visible) and asserts each expanded row uses `<MatchCard>`.
- Test: `components/match-card.test.tsx` adds a player-vs-player fixture and asserts: full names render, no logo placeholder div is rendered, no prefix/mascot split is applied.
- Test: `lib/espn/catalog.test.ts` asserts the catalog contains entries for the four Grand Slams keyed by year-less id.
- Test: `lib/favorites/validators.test.ts` accepts `{ type: "event", sport: "Tennis", externalId: "tennis/atp/wimbledon" }`.
- Screenshot: `docs/specs/05-spec-tennis/05-proofs/05-tournament-card-expanded.png` showing an expanded tournament card with `MatchCard` rows.
- Screenshot: `docs/specs/05-spec-tennis/05-proofs/05-search-tennis.png` showing the search results when typing "wimbledon".
- Diff: `README.md` shows the new release-note line.
- CLI: full CI gate transcript (`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`) saved to `05-proofs/05-ci-gates.txt`.

## Non-Goals (Out of Scope)

1. **ATP/WTA 250 and 500 events, Challenger, ITF, college tennis** — only the four Slams + ATP/WTA 1000s in v1 (Q1 (D)).
2. **Player favorites as a new `FavoriteType`** — players are not directly favoritable in this spec. Following a player is deferred to a future spec.
3. **Doubles draws** — singles only in v1 (ESPN exposes both; we filter to singles).
4. **Mid-tournament drill-down beyond today** — the expanded view shows today's matches only. Full draw / bracket views are out of scope.
5. **Per-tournament venue timezones for the count semantics** — Q4 Round 2 picks user-local "today" semantics (consistent with the rest of the homepage).
6. **Bottom-nav redesign and Settings page** — deferred to Spec 06 per the prior planning conversation.
7. **Live polling cadence change** — tennis reuses the existing 60-second client-side homepage poll; no new realtime infra.

## Design Considerations

- The collapsed `TournamentCard` shall be visually distinct from `MatchCard` (no two-column team layout, no center score cell) so users can immediately tell it's a different primitive. A compact, single-row layout with the tournament name on the left and the counts row on the right is preferred for mobile.
- The expanded state shall render the matches list using the same `MatchCard` component already used for team-sport matches. Spacing between match rows shall match the existing homepage's between-card spacing so the expanded view feels native.
- The card chrome (border, padding, dark-mode variants) shall match `MatchCard`'s established treatment (`border-zinc-200 dark:border-zinc-800`, `rounded-md`, `p-2.5`).
- Tap affordance shall be obvious: the collapsed card displays a small chevron that rotates on expand.
- Honor `min-h-dvh` and safe-area insets per `AGENTS.md`.

## Repository Standards

- Next.js 16 App Router; server components by default; client components marked with `"use client"`. The `TournamentCard`'s expand state is local React state and so MUST be a client component.
- TypeScript `strict`. No `any`. No `@ts-ignore` / `@ts-expect-error` without a tracked TODO.
- Tailwind v4 mobile-first; `sm:` `md:` `lg:` only layer adjustments.
- Drizzle ORM. No schema change is required (Q3 Round 1 (B) reuses the existing `event` favorite type; `favorites.sport` is free text).
- Vitest + RTL, colocated tests next to the source (`tournament-card.test.tsx` next to `tournament-card.tsx`).
- ESLint + Prettier; Conventional Commits with the body `Related to T#.# in Spec 05-spec-tennis`.

## Technical Considerations

- **Per-tournament endpoint shape:** ESPN's tennis scoreboard URLs follow `site.api.espn.com/apis/site/v2/sports/tennis/{tour-or-slam-slug}/scoreboard` and accept a `dates=YYYYMMDD` query. The `tennisScoreboard` function shall use the same `fetch` + Zod parsing approach as `scoreboardForLeague`; if Zod parsing fails for an individual event inside the response, that event is dropped (matching existing per-league behavior) but the call as a whole still returns the surviving events.
- **Active-tournament cache:** the new 1h cache (`getActiveTennisTournaments`) wraps the fan-out to all 23 marquee tournaments. The aggregator stays a simple consumer — it does not loop over the registry directly.
- **MatchCard player extension:** the `Match` type already has optional `homeTeamLogo` / `awayTeamLogo`. The change is that when both are absent AND the sport is `"Tennis"`, the card renders without the logo slot and the `splitTeamName` helper is bypassed. Treat this as a render-time branch, not a new `Match` subtype.
- **Year-less externalId convention:** for tennis tournaments, `externalId = tennis/{tour}/{slug}` (lowercase, hyphens). The slug is stable across years (`wimbledon`, `australian-open`, etc.). The catalog test pins these values so they cannot drift.
- **Sort key:** `aggregator.ts` shall pass the earliest live/upcoming `kickoffUtc` for each tournament card as its sort key. Tournament cards with no live or upcoming match today sort below all match cards for the day. This keeps the sort stable enough not to flicker on a 60s poll (the earliest match's kickoff time doesn't change as the poll repeats).
- **No new runtime dependencies.** No DB migration.

## Security Considerations

- ESPN's tennis API is unauthenticated; no API keys or tokens are introduced.
- No user-supplied input flows into the ESPN URL — `tournamentId` is always one of the 23 hardcoded marquee identifiers.
- Proof-artifact screenshots shall be redacted if they incidentally capture the user's email in the account menu.
- No new sensitive data is added to the favorites schema.

## Success Metrics

1. **Coverage:** during an active Grand Slam, the homepage shows exactly one tournament card for that Slam with non-zero counts. Verified by screenshot + integration fixture.
2. **Endpoint pressure:** outside the active window for every marquee tournament, `getActiveTennisTournaments(today)` returns `[]` and the homepage renders no tennis cards. Verified by a fixture where every tournament's scoreboard returns empty.
3. **Cache invalidation:** post-deploy, the homepage does NOT serve cached pre-tennis planning results (verified by the `CACHE_KEY_PREFIX === "v7-espn-tennis"` test).
4. **Favorites stability:** a `Tennis` `event` favorite created with externalId `tennis/atp/wimbledon` in 2026 is still valid in 2027 with no migration. Verified by the catalog/validator tests pinning the year-less id format.
5. **CI gates green:** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build` all exit 0.
6. **Scope discipline:** the only files outside `lib/espn/`, `lib/home/`, `lib/sports/`, `lib/favorites/`, `lib/sport-allowlist*`, `components/tournament-card*`, `components/match-card*`, `components/home-client*`, `README.md`, and the spec's own `docs/specs/05-spec-tennis/` directory that this spec modifies are: the homepage route file (`app/(app)/home/page.tsx` or its existing aggregator wiring) and the favorites search route handler + test (`app/api/favorites/search/route.ts`, `app/api/favorites/search/route.test.ts`) to thread `activeTennisTournaments` and the Tennis catalog branch. No other route handlers, no bottom-nav, no auth, no DB schema changes.

## Open Questions

1. ESPN's exact slug for each ATP 1000 / WTA 1000 event needs to be confirmed at implementation time — there is normal vendor drift in ESPN's URL conventions. The implementation MAY temporarily mark unverified slugs with a `// TODO(05): verify against ESPN` comment, but the proof bundle MUST include a CLI capture confirming each of the 23 endpoints returned a 200 (even if the body is empty) at least once.
2. When a tournament card is expanded and a match's status transitions from `upcoming` to `live` during a 60s poll, do we want a subtle highlight animation? Not a v1 requirement — listing here so it doesn't get lost.
