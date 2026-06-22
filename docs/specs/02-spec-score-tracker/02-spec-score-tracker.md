# 02-spec-score-tracker.md

## Introduction/Overview

This spec delivers the core ScoreMate product: a mobile-first homepage that, for each signed-in user, shows only the sports matches that match their favorited teams, sports, leagues, and tournaments — scoped to a tight three-day window of yesterday, today, and tomorrow. It builds directly on [01-spec-auth-foundation](../01-spec-auth-foundation/01-spec-auth-foundation.md), which provides authentication, the Neon database, and the deployed Vercel shell. The goal is to give a sports fan a single glance-able screen — first and foremost on their phone — that answers "what happened, what's on now, what's next?" without the noise of a general sports site.

> **Context note:** The clarifying-questions file that drove both this spec and the auth foundation spec lives at [01-questions-1-auth-foundation.md](../01-spec-auth-foundation/01-questions-1-auth-foundation.md).

## Goals

- Let a signed-in user add and remove favorites across four target types — Team, Sport, League, and Event/Tournament — for four sports: Soccer, American Football (NFL + top NCAA), Basketball (NBA + top NCAA), and Tennis.
- Persist favorites per user in Neon Postgres so they follow the user across devices.
- Show a mobile-first homepage that lists every match — drawn from the user's favorites — whose scheduled date is yesterday, today, or tomorrow in the user's local browser timezone.
- Display completed-match results, in-progress live scores (auto-refreshing every 60 seconds when at least one tracked match is live), and upcoming-match details (kickoff time, teams, venue, competition + round, broadcast/streaming info when the data source provides it).
- Source all match data from TheSportsDB's free tier via server-side Next.js Route Handlers that proxy and cache responses.

## User Stories

- **As a soccer fan**, I want to favorite "Team USA Men's Soccer" so that I see Team USA's recent and upcoming matches on my homepage without scrolling through other teams.
- **As a sports generalist**, I want to favorite the sport "Soccer" so that I see the day's notable soccer matches (curated top leagues + major tournaments) without favoriting each league individually.
- **As a league follower**, I want to favorite the "Premier League" so that I see every Premier League match in my three-day window.
- **As an event watcher**, I want to favorite "World Cup 2026" so that I see every match in that specific tournament while it's running, and the favorite quietly stops producing matches once the tournament ends.
- **As a returning user**, I want my favorites to be tied to my account so that they follow me from my laptop to my phone.
- **As a user on my phone during a live match**, I want the score on my homepage to update without me hitting refresh so that I can keep the tab open while I do something else.
- **As a user planning my evening on the train**, I want each upcoming match card to show kickoff time, competition, round, venue, and broadcast info (when available) so that I can decide whether and where to watch — all from a phone screen.

## Demoable Units of Work

### Unit 1: Favoriting (Team, Sport, League, Event)

**Purpose:** Let the signed-in user build their personalized list of things to track. This is the single source of input that drives the homepage.

**Functional Requirements:**

- The system shall provide a mobile-first search/browse experience that lets the user find a Team, Sport, League, or Event/Tournament across the four supported sports (Soccer, American Football, Basketball, Tennis).
- The system shall let the user add any found item to their favorites with one tap and remove it with one tap.
- The system shall persist favorites in the Neon Postgres database, scoped to the signed-in user, via authenticated server actions or Route Handlers.
- The system shall reflect the current favorite state (added vs not added) in the UI without a full page reload.
- The system shall treat each favorite type with the following semantics:
  - **Team**: include any match where the team is the home or away participant.
  - **Sport**: include any match in that sport whose league/tournament is on the curated "top matches most people care about" allowlist for that sport (see Technical Considerations).
  - **League**: include any match in that league.
  - **Event/Tournament**: include any match within that specific tournament instance; the favorite has no effect outside the tournament's dates, but remains on the user's favorites list (silent-expire behavior).
- The system shall let the user view all their current favorites on a dedicated "My Favorites" screen and remove any of them from there.
- The system shall allow a user to have multiple favorites of the same type and across types simultaneously (e.g., favoriting both "Team USA" and "Premier League").
- The system shall handle the empty-favorites state explicitly: a user with zero favorites sees a clear prompt to add some, not an empty homepage.
- The system shall prevent duplicate favorites (same `type` + `external_id` for the same user) at the database level via a unique constraint.

**Proof Artifacts:**

- Screenshot: the favorites search/browse screen at a 375px mobile viewport with type-labeled results visible (e.g., "Team USA — Team", "Premier League — League") demonstrates the discovery flow works on mobile.
- Screenshot: the "My Favorites" screen at a 375px mobile viewport listing one of each favorite type (Team, Sport, League, Event) demonstrates all four target types persist correctly.
- Live URL walkthrough: adding a favorite on a mobile browser, signing out, signing back in on a desktop browser with the same account, and seeing the same favorite still present demonstrates server-side persistence per user across devices.
- Screenshot: the zero-favorites empty state on the "My Favorites" screen demonstrates the empty-state UX is handled.

### Unit 2: Homepage Score Tracker (yesterday / today / tomorrow)

**Purpose:** The payoff screen — a single mobile-first page that answers "what's relevant to me right now?" across yesterday, today, and tomorrow.

**Functional Requirements:**

- The system shall, on homepage load, compute the date range [yesterday, today, tomorrow] in the user's local browser timezone.
- The system shall query TheSportsDB via server-side Route Handlers for matches within that date range that match any of the signed-in user's active favorites.
- The system shall display matches grouped by day under "Yesterday," "Today," and "Tomorrow" section headings, in that vertical order.
- The system shall render each match as a card showing, at minimum: both participants, the competition name, the round/matchweek when available, the venue when available, and the local kickoff time.
- The system shall show completed-match cards with the final score and a "Final" indicator.
- The system shall show in-progress cards with the live score, current period/minute/set, and a visually distinct "Live" indicator.
- The system shall show upcoming-match cards with kickoff time and, when the data source provides it, broadcast channel and/or streaming info.
- The system shall, while at least one card on screen is in the "in-progress" state, auto-refresh match data every 60 seconds without a full page reload.
- The system shall stop auto-refreshing when no card is in the in-progress state.
- The system shall pause auto-refresh when the browser tab is hidden and resume when it becomes visible again (using the Page Visibility API) to be polite to the data source and the user's battery.
- The system shall de-duplicate matches that would be matched by more than one of the user's favorites (e.g., a Premier League match for a favorited team in the favorited Premier League shows once, not twice).
- The system shall handle the data-source failure case gracefully: if TheSportsDB is unreachable or returns an error, the homepage shall show a non-blocking error banner and any successfully-fetched data still renders.
- The system shall handle the no-matches case explicitly: if the user's favorites produce zero matches in the window, the homepage shall show a "No matches in your window — check back tomorrow" empty state rather than appearing broken.
- The system shall render the entire homepage correctly on a 375px-wide viewport with no horizontal scroll; cards stack vertically on mobile and may lay out in a multi-column grid at wider breakpoints.

**Proof Artifacts:**

- Screenshot: the homepage at the live Vercel URL at a 375px mobile viewport with at least one card under each of Yesterday, Today, and Tomorrow demonstrates the mobile-first date-window scoping works end-to-end.
- Screenshot: the same homepage at a 1280px desktop viewport demonstrates the responsive multi-column layout layering.
- Screenshot: a card in the "Live" state with a visible score and minute/period/set indicator demonstrates the in-progress rendering path.
- Screenshot: an upcoming card showing kickoff time, competition, round, venue, and broadcast info demonstrates the future-match detail level.
- Live URL walkthrough: opening the homepage on a mobile device during a live match, leaving it idle for 60+ seconds, and seeing the score change without a page reload demonstrates auto-refresh works on mobile.
- Screenshot: the "No matches in your window" empty state demonstrates the no-data UX is handled.

## Non-Goals (Out of Scope)

1. **No authentication work** — covered by [01-spec-auth-foundation](../01-spec-auth-foundation/01-spec-auth-foundation.md). This spec assumes a signed-in user.
2. **No notifications** — no email, push, or in-app notifications when a match starts, ends, or a goal is scored. The user pulls; the app does not push.
3. **No social features** — no following other users, sharing favorites, commenting, or reactions.
4. **No historical data beyond yesterday** — archive browsing, season standings, all-time records, and head-to-head history are excluded. The window is fixed at [yesterday, today, tomorrow].
5. **No editorial content** — no news articles, match previews, recaps, or commentary; only structured match data.
6. **No betting odds or fantasy integration.**
7. **No "Event series" favorites** (e.g., "World Cup" recurring forever); only specific tournament instances (e.g., "World Cup 2026") are supported in v1.
8. **No sport-wide "all matches" favoriting** — the Sport favorite is curated to top matches per the allowlist, not every match in the sport.
9. **No sports outside the launch four** (Soccer, American Football, Basketball, Tennis). Hockey, baseball, MMA, motorsports, cricket, etc. are explicitly excluded in v1.
10. **No native mobile app** — mobile-first responsive web only.
11. **No offline mode** — the app requires an active network connection to fetch scores.
12. **No paid-API integration** — v1 uses only TheSportsDB's free tier.
13. **No fallback data source** — if TheSportsDB lacks coverage for a sport/league (notably US college basketball/football), the gap is accepted for v1; no ESPN fallback in this spec.
14. **No timezone selection UI** — the user's browser timezone is the only timezone for v1.
15. **No automatic archival of expired Event favorites** — they silently stop producing matches and remain on the favorites list until the user removes them manually.

## Design Considerations

- **Mobile-first is a hard requirement.** Every screen in this spec must be designed and verified at a ~375px-wide viewport first; larger viewports are progressive enhancements.
- Touch targets for primary actions (add-favorite, remove-favorite, navigation) must be at least 44×44 CSS px.
- The homepage should feel scannable on a phone: clear day headers (Yesterday / Today / Tomorrow) that stay readable while scrolling, uniform card heights within each section, and an unmistakable visual distinction between Final, Live, and Upcoming states (e.g., a colored "LIVE" pill that pulses subtly, a muted "Final" label, a clock icon for Upcoming).
- The favoriting experience should make it obvious which of the four target types the user is adding; a typeahead search with type-labeled results (e.g., "Team USA — Team", "Premier League — League") is preferred over four separate flows.
- Card layouts must accommodate long team/competition names on narrow screens (truncate with ellipsis, or wrap cleanly).
- Use bottom-of-screen primary navigation if multiple screens (Home, Favorites) exist — thumb-reachable on phones — and switch to top navigation only at wider breakpoints if at all.
- No specific mockups exist; follow conventional sports-app mobile patterns and Tailwind defaults.

## Repository Standards

Inherits all conventions established in [01-spec-auth-foundation](../01-spec-auth-foundation/01-spec-auth-foundation.md) without change:

- TypeScript `strict`, Next.js App Router, Tailwind CSS (mobile-first), Drizzle ORM, ESLint + Prettier, Conventional Commits, `.env.example` for configuration.
- New tables introduced by this spec live under `db/schema/` alongside the existing Auth.js tables.
- New Route Handlers live under `app/api/`; new shared logic (e.g., favorite-matching, allowlist, TheSportsDB client) under `lib/`.

## Technical Considerations

- **Data source:** TheSportsDB free tier, accessed only from server-side Route Handlers under `app/api/`. This sidesteps browser CORS and gives a single place to add caching and, later, swap providers. Likely endpoints:
  - `eventsday.php?d=YYYY-MM-DD&s=<Sport>` — events on a given date for a sport.
  - `eventsnext.php?id=<teamId>` / `eventslast.php?id=<teamId>` — recent/upcoming events for a team.
  - `searchteams.php?t=<name>` — team search for the favorites UI.
  - `search_all_leagues.php?s=<Sport>` — league discovery.
- **Server-side caching:** wrap TheSportsDB calls with Next.js `unstable_cache` (or equivalent), with TTLs tuned to data volatility:
  - 30 seconds for in-progress/live data.
  - 5 minutes for today's not-yet-started matches.
  - 10 minutes for yesterday's completed matches and tomorrow's upcoming matches.
- **Database schema (additions on top of the Auth.js tables from the foundation spec):**
  - `favorites` (
    `id` UUID PK,
    `user_id` UUID FK → `users.id` ON DELETE CASCADE,
    `type` ENUM(`team`, `sport`, `league`, `event`),
    `external_id` TEXT — TheSportsDB id (team id, league id, season/event id) or the canonical sport name for `type='sport'`,
    `display_name` TEXT,
    `sport` TEXT — denormalized for fast filtering ('Soccer', 'American Football', 'Basketball', 'Tennis'),
    `metadata` JSONB — optional, for things like a tournament's start/end dates,
    `created_at` TIMESTAMP DEFAULT now()
    )
  - UNIQUE constraint on (`user_id`, `type`, `external_id`) to prevent duplicates.
  - INDEX on (`user_id`) for fast lookup.
- **Sport favorite allowlist ("top matches most people care about"):** encoded as a TypeScript constant in `lib/sport-allowlist.ts` so it can be reviewed in code and updated without a schema change. Starting list (per user confirmation, no curation changes for v1):
  - **Soccer:** Premier League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, UEFA Champions League, UEFA Europa League, FIFA World Cup, UEFA Euros, Copa América, FIFA Women's World Cup.
  - **American Football:** NFL (regular season + playoffs), NCAA FBS Top-25 and ranked-vs-ranked matchups, College Football Playoff, major bowl games.
  - **Basketball:** NBA (regular season + playoffs), NCAA Division I Top-25 and ranked-vs-ranked matchups, NCAA tournament (March Madness), WNBA Finals.
  - **Tennis:** the four Grand Slams (Australian Open, Roland-Garros, Wimbledon, US Open), ATP Masters 1000 events, WTA 1000 events, ATP/WTA Finals.
  - Each entry stores the TheSportsDB league/tournament id where applicable; entries without a clean id mapping (e.g., "Top-25 NCAA matchups") use a server-side filter that the allowlist module exposes.
- **TheSportsDB coverage gaps:** TheSportsDB's coverage of US college basketball and college football can be uneven. Per user decision, this is accepted as-is for v1 (no ESPN fallback). The UI should not pretend a sport has full coverage when it doesn't — surface gaps as "No matches in your window" rather than blank cards.
- **Timezone handling:** compute the [yesterday, today, tomorrow] window in the browser using `Intl.DateTimeFormat().resolvedOptions().timeZone` and the device's clock; send three `YYYY-MM-DD` strings to the server. The server must not assume a timezone.
- **Auto-refresh strategy (client-side polling):**
  - 60-second interval via `setInterval` inside a client component.
  - Gated on "at least one in-progress match present on the page."
  - Paused via `document.visibilityState !== 'visible'` (Page Visibility API).
  - In-flight requests canceled via `AbortController` on unmount and on visibility-hidden transitions.
- **Mobile-first build conventions (inherited):** default Tailwind classes target small screens; `sm:`/`md:`/`lg:` modifiers layer on larger-screen adjustments; `min-h-dvh` for full-height layouts; safe-area insets respected.
- **Data freshness:** treat all data as best-effort. Final scores from TheSportsDB can lag minutes after the real-world final; document this in the UI footer ("Scores via TheSportsDB; may lag live broadcasts").
- **Error handling:** every Route Handler returns a typed result; UI distinguishes "no data" (empty state) from "fetch failed" (error banner).
- **Testing:** unit tests for (a) the favorite-matching logic (does favorite X match event Y?), (b) the date-window computation, (c) the sport-allowlist matcher. End-to-end tests deferred per the user's proof-artifact choice.

## Security Considerations

- **TheSportsDB free key** (documented as `1` / `3`) is not secret but is called only from server-side Route Handlers so it can be swapped for a real key later without leaking to the client bundle.
- **Favorite write endpoints** require a valid session (Auth.js); writes are scoped server-side to `session.user.id`, not to any client-supplied user id, to prevent IDOR.
- **Input validation:** all client-supplied favorite payloads (type, external_id, display_name) are validated server-side with a schema validator (e.g., Zod). Reject anything outside the four sports / four favorite types.
- **Rate limiting:** apply a per-user rate limit on favorite-write endpoints (e.g., 60 writes/minute) using an in-memory or Vercel KV-based limiter to mitigate accidental loops or abuse.
- **No sensitive data in URLs:** favorite ids and external ids may appear in URLs; user ids must not.
- **Proof artifact hygiene:** screenshots used as proof must not include real OAuth tokens, session cookies, or full personal email addresses; use a test account.
- **No client-leaked secrets:** verify before each deploy that `NEXT_PUBLIC_*` env vars contain nothing sensitive.

## Success Metrics

1. **Functional completeness:** all functional requirements in Units 1 and 2 pass manual verification at the live URL on both a mobile (≤375px) and desktop (≥1280px) viewport — 100% target.
2. **End-to-end demo path on mobile:** a signed-in user can favorite at least one of each of the four target types and see at least one match populated on the homepage — completes in under 3 minutes on a phone without developer assistance.
3. **Live-update correctness:** during a real in-progress match, the homepage reflects an updated score within 90 seconds of TheSportsDB updating (60s poll + ~30s upstream lag) — measured at least once on a real match.
4. **No-noise homepage:** for a user who has favorited only "Soccer" (sport-level), the homepage on a typical Saturday shows fewer than ~25 cards across the three days — confirming the curated allowlist keeps the page usable on a phone.
5. **Mobile-first compliance:** all screens render correctly with no horizontal scroll and ≥44px primary touch targets at 375px width — 100% target via manual inspection.
6. **Uptime / availability:** the deployed homepage responds 2xx for a signed-in user 99% of measured page loads across a one-week post-launch window.

## Open Questions

No blocking open questions at this time. The starting allowlist in Technical Considerations may be refined during implementation if TheSportsDB league-id lookups reveal mismatches; refinements are repo-level changes and do not require a new spec round.
