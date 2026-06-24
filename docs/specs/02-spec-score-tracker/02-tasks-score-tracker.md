# 02-tasks-score-tracker.md

> Task list for [02-spec-score-tracker.md](./02-spec-score-tracker.md). Builds on the auth + DB foundation from [01-spec-auth-foundation](../01-spec-auth-foundation/01-spec-auth-foundation.md) (live at `https://score-mate-chi.vercel.app`).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/sportsdb/types.ts` | Internal normalized types (`Match`, `Team`, `League`, `Event`, `MatchStatus`) consumed across the app. |
| `lib/sportsdb/client.ts` | Typed wrapper around the TheSportsDB free-tier endpoints (`eventsday.php`, `eventsnext.php`, `eventslast.php`, `searchteams.php`, `search_all_leagues.php`). Server-side only. |
| `lib/sportsdb/client.test.ts` | Unit tests: URL building + fixture parsing for each endpoint. |
| `lib/sportsdb/__fixtures__/*.json` | Sample TheSportsDB JSON responses (≥1 per sport) used by tests so we never hit the network in CI. |
| `lib/sport-allowlist.ts` | The spec's curated Sport-favorite allowlist (Soccer / American Football / Basketball / Tennis), plus `matchesSportAllowlist(sport, match)` helper. |
| `lib/sport-allowlist.test.ts` | Asserts allowlist accepts/rejects per the spec. |
| `lib/favorite-matcher.ts` | Pure function: given user favorites + matches → deduplicated matching set. Implements all four favorite-type semantics + Event silent-expire. |
| `lib/favorite-matcher.test.ts` | Covers Team/Sport/League/Event semantics + dedup. |
| `lib/date-window.ts` | Browser-timezone helper producing `[yesterday, today, tomorrow]` as `YYYY-MM-DD` strings. |
| `lib/date-window.test.ts` | Timezone-boundary tests (e.g. US/Eastern at 23:30 local). |
| `db/schema/favorites.ts` | Drizzle schema for the `favorites` table per the spec. |
| `db/schema/index.ts` | Barrel — re-exports `favorites`. |
| `db/migrations/000N_*.sql` | Auto-generated migration adding the `favorites` table (+ unique + index). |
| `lib/favorites/validators.ts` | Zod schemas for favorite create/delete payloads. |
| `lib/favorites/validators.test.ts` | Asserts only the four `type` values + four `sport` values are accepted. |
| `lib/favorites/queries.ts` | Server-side data layer: `listFavoritesForUser`, `createFavorite`, `deleteFavorite`. All scope by `userId` server-side. |
| `lib/rate-limit.ts` | In-memory per-user write-rate limiter. |
| `lib/rate-limit.test.ts` | Asserts 60 writes/min cap. |
| `app/api/favorites/route.ts` | `GET` (list current user's favorites) + `POST` (add one). Auth-gated, Zod-validated, rate-limited. |
| `app/api/favorites/route.test.ts` | Covers 401, 200 list, 201 create, 409 duplicate, 400 bad payload, 429 rate-limit. |
| `app/api/favorites/[id]/route.ts` | `DELETE` one favorite. Auth-gated; only removes rows owned by the calling user. |
| `app/api/favorites/[id]/route.test.ts` | Covers 401, 204 happy path, 404 not-owned-by-user. |
| `app/(app)/layout.tsx` | Shared layout for the three signed-in screens (Home, Favorites, My Favorites). Renders `<BottomNav />` and gates with `await auth()`. |
| `app/(app)/home/page.tsx` | The score-tracker homepage. Replaces the spec-01 placeholder at `app/home/page.tsx`. |
| `app/(app)/home/page.test.tsx` | Asserts the day groups, empty state, and error banner render correctly. |
| `app/(app)/favorites/page.tsx` | Search/browse screen with typeahead. |
| `app/(app)/favorites/page.test.tsx` | Asserts type-labeled results render, Add CTAs meet 44 px, click transitions row to "Added". |
| `app/(app)/my-favorites/page.tsx` | List + remove screen. |
| `app/(app)/my-favorites/page.test.tsx` | Asserts each persisted type renders with a Remove control; empty state when none. |
| `middleware.ts` | Update matcher to cover `/(app)/...` (currently only `/home/*`). |
| `components/bottom-nav.tsx` | Mobile bottom nav (Home / Favorites / My Favorites), 44 px targets, route-aware active state. |
| `components/bottom-nav.test.tsx` | Asserts the three nav items render, satisfy 44 px, and highlight the current route. |
| `components/favorites-search.tsx` | Client component: typeahead + result list (calls a search-only Route Handler under the hood — see `app/api/favorites/search`). |
| `app/api/favorites/search/route.ts` | Server-side typeahead endpoint (calls `searchteams.php` + league/event search in parallel). |
| `app/api/favorites/search/route.test.ts` | Asserts merged + type-labeled results. |
| `components/favorite-add-button.tsx` | Optimistic Add/Added toggle. |
| `components/favorite-remove-button.tsx` | Optimistic Remove. |
| `components/match-card.tsx` | Renders Final / Live / Upcoming branches. |
| `components/match-card.test.tsx` | Covers all three branches, long-name truncation, 44 px on interactives. |
| `components/day-section.tsx` | Day header (Yesterday / Today / Tomorrow) + responsive grid of cards. |
| `components/no-matches-empty-state.tsx` | "No matches in your window — check back tomorrow." |
| `components/data-source-error-banner.tsx` | Non-blocking banner shown when `source.ok === false`. |
| `components/home-client.tsx` | Client component that owns the date-window computation, `/api/home` fetch, polling, and visibility gating. |
| `components/home-client.test.tsx` | Polling test using `vi.useFakeTimers()` covering the 4 polling FRs. |
| `lib/home/aggregator.ts` | Orchestrates per-favorite TheSportsDB calls, merges via `favorite-matcher`, dedups, sorts by kickoff. |
| `lib/home/aggregator.test.ts` | Fixture-driven test across all four sports. |
| `lib/home/cache.ts` | `unstable_cache` wrappers with the 3 TTLs (30 s / 5 min / 10 min). |
| `app/api/home/route.ts` | `GET /api/home?dates=YYYY-MM-DD,YYYY-MM-DD,YYYY-MM-DD` returning the typed envelope. |
| `app/api/home/route.test.ts` | Covers 401, empty-favorites, dedup, kickoff-sort, partial-failure envelope. |
| `README.md` | Update Operations section with new env vars / endpoints (none expected, but verify). |

### Notes

- Tests are colocated with the code they test (e.g. `match-card.tsx` next to `match-card.test.tsx`). Route handler tests live at `route.test.ts` next to the `route.ts`.
- Run tests with `pnpm test:ci`; run a single suite via `pnpm test:ci <path>`.
- All TypeScript must pass `pnpm typecheck` with `strict` enabled — no `any`, no untracked `@ts-ignore`.
- Tailwind: default classes target small screens; use `sm:`/`md:`/`lg:` only for upward adjustments. Touch targets ≥44×44 px via `min-h-11 min-w-11`. Full-height layouts use `min-h-dvh`. Safe-area insets respected.
- Conventional Commits enforced via commitlint in CI (`feat:` for user-facing slices, `feat(api):` for endpoints, `feat(db):` for schema, `chore:`/`docs:`/`test:` as appropriate).
- TheSportsDB calls live **only** in server-side code (under `app/api/` or `lib/sportsdb/`). The client never calls TheSportsDB directly — CORS-safe by design.
- The placeholder `/home` from spec 01 (`app/home/page.tsx`) is **replaced** by `app/(app)/home/page.tsx`. Delete the old file in Task 5.0; do not leave duplicates.

## Tasks

### [x] 1.0 Build the TheSportsDB client, sport allowlist, and favorite-matching primitives (lib-only, fully unit-tested)

#### 1.0 Proof Artifact(s)

- Test: `lib/sportsdb/client.test.ts` passes — asserts the client builds correct URLs for each endpoint and parses sample TheSportsDB JSON fixtures into the internal `Match` type.
- Test: `lib/sport-allowlist.test.ts` passes — asserts a sample match in each allowlisted league/tournament is accepted, and at least one out-of-list league is rejected, for every one of the four sports.
- Test: `lib/favorite-matcher.test.ts` passes — covers all four favorite-type semantics (Team home/away, Sport via allowlist, League, Event in-tournament + Event silent-expire) and the dedup case where one match matches multiple favorites.
- Test: `lib/date-window.test.ts` passes — asserts the window is computed correctly across timezone boundaries.
- Test: `lib/favorite-matcher.test.ts` (additional case) — a Sport favorite for Soccer paired with an out-of-allowlist league (e.g. EFL Championship) returns zero matches, demonstrating Sport favorites stay bounded to the curated set (closes the non-goal-leakage risk on "all matches" Sport favorites).
- CLI: `pnpm test:ci` shows all four new test files green; total test count strictly greater than 26.
- File diff: `lib/sportsdb/`, `lib/sport-allowlist.ts`, `lib/favorite-matcher.ts`, `lib/date-window.ts` + colocated tests present in the commit.

#### 1.0 Tasks

- [x] 1.1 Authored `lib/sportsdb/types.ts` with `Sport`, `MatchStatus`, `Team`, `League`, `EventInstance`, `Match`, `Favorite`, plus `SUPPORTED_SPORTS` and `FAVORITE_TYPES` const arrays.
- [x] 1.2 Added 6 fixtures under `lib/sportsdb/__fixtures__/`: one `eventsday-*` per sport (Soccer/American Football/Basketball/Tennis) plus `searchteams.json` and `search-all-leagues-soccer.json`. Each <2 KB, hand-curated to cover final/live/upcoming + scores.
- [x] 1.3 Implemented `lib/sportsdb/client.ts` with `eventsDay`/`eventsNext`/`eventsLast`/`searchTeams`/`searchAllLeagues` plus pure URL builders and parsers (exported for tests). Status string mapping handles "Match Finished"/"In Play"/"Not Started" variants. SERVER-ONLY doc comment at top.
- [x] 1.4 Authored `lib/sportsdb/client.test.ts`: URL-builder assertions for all 5 endpoints (incl. URL-encoding for "American Football" and "Team USA"); fixture-driven parser assertions for all four sports covering final/live/upcoming + score parsing + `events: null` empty case + non-OK status throws.
- [x] 1.5 Authored `lib/sport-allowlist.ts` with the full spec allowlist (Soccer/American Football/Basketball/Tennis), using leagueId where stable and `leagueNameContains` substring fallback for NCAA + tennis cases. Exports `matchesSportAllowlist`.
- [x] 1.6 Authored `lib/sport-allowlist.test.ts`: shape sanity (each sport has entries, every entry has id-or-name), plus accept/reject per sport.
- [x] 1.7 Implemented `lib/favorite-matcher.ts` with `matchFavoritesAgainstMatches(favorites, matches)`. Team checks home OR away; Sport gates on `matchesSportAllowlist`; League checks `leagueId`; Event checks `eventInstanceId` AND `dateUtc ∈ [startDate, endDate]` (silent-expire when window missing or in the past). Dedup by `match.id` preserving order.
- [x] 1.8 Authored `lib/favorite-matcher.test.ts`: per-type happy-path + dedup (a match claimed by Team + League + Sport favorites appears exactly once) + Event silent-expire (favorite with past `endDate` produces 0 matches) + null-metadata Event (also 0 matches by design).
- [x] 1.9 Implemented `lib/date-window.ts` using `Intl.DateTimeFormat("en-CA", { timeZone, year, month, day })` to emit YYYY-MM-DD strings; offsets `now` ±24h in UTC ms to keep DST correct. Also exports `getBrowserTimezone()` helper.
- [x] 1.10 Authored `lib/date-window.test.ts`: UTC noon, `America/New_York` at 23:30 local (UTC 03:30 next day), `Pacific/Kiritimati` +14 at 00:30 local, DST spring-forward day, leap-year boundary (2028-02-29), zero-padded format check.
- [x] 1.11 Added "Sport favorite REJECTS EFL Championship" assertion (and a Soccer-vs-Basketball cross-sport rejection) inside `lib/favorite-matcher.test.ts`. **Closes audit finding F2.**

---

### [x] 2.0 Add the `favorites` Drizzle schema and the favorites CRUD API (auth-gated, Zod-validated, rate-limited)

#### 2.0 Proof Artifact(s)

- File diff: `db/schema/favorites.ts`, new migration SQL under `db/migrations/`, `app/api/favorites/route.ts` (+ `[id]/route.ts`), `lib/favorites/*` all present and committed.
- CLI: after `pnpm db:migrate` against dev Neon, `\dt favorites` lists the table and `\d favorites` shows the UNIQUE on (`userId`, `type`, `externalId`) and INDEX on (`userId`).
- Test: `app/api/favorites/route.test.ts` (+ `[id]/route.test.ts`) pass — covering 401, scoped POST, duplicate handling, scoped DELETE, malformed payload (400), rate-limit (429).
- Test: cross-user DELETE attempt in `app/api/favorites/[id]/route.test.ts` returns 404 and leaves the target row intact (closes the IDOR-regression risk on the DELETE endpoint).
- Test: `lib/favorites/validators.test.ts` passes — Zod accepts only the four `type` values and four `sport` values.

#### 2.0 Tasks

- [x] 2.1 Authored `db/schema/favorites.ts` per the spec: text id (`crypto.randomUUID()`), `pgEnum("favorite_type", [...])`, FK to users.id ON DELETE CASCADE, jsonb metadata typed as `{ startDate?, endDate? }`, uniqueIndex(userId,type,externalId), index(userId).
- [x] 2.2 Re-exported `favorites` from `db/schema/index.ts`.
- [x] 2.3 `pnpm db:generate` produced `db/migrations/0002_freezing_norrin_radd.sql`. Migration creates the enum + table + FK + 2 indexes.
- [x] 2.4 `pnpm db:migrate` applied successfully to dev Neon; verified via inspect script: table + 8 columns + 3 indexes (pkey + unique-3col + user_id idx) all present.
- [x] 2.5 `lib/favorites/validators.ts`: strict Zod schemas. `favoriteTypeSchema` (enum of FAVORITE_TYPES), `sportSchema` (enum of SUPPORTED_SPORTS), `createFavoriteSchema` (.strict()) including optional metadata window with YYYY-MM-DD regex, `deleteFavoriteParamsSchema` (.strict()).
- [x] 2.6 `lib/favorites/queries.ts`: `listFavoritesForUser` (ORDER BY createdAt DESC), `createFavorite` using onConflictDoNothing then scoped re-select (returns `{ row, existed }`), `deleteFavorite` with `WHERE id = ? AND user_id = ?` returning bool.
- [x] 2.7 `lib/rate-limit.ts`: sliding-window in-memory limiter (`Map<key, number[]>`) with configurable window/max, default 60/min. Denied attempts do NOT push out earlier allowed ones. In-memory caveat documented at top of file.
- [x] 2.8 `app/api/favorites/route.ts`: GET (auth → list) and POST (auth → rate-limit → JSON parse → Zod parse → create). Returns 201 for new, 200 for duplicate (existed=true), 400 for malformed JSON or Zod failure, 401 unauth, 429 with Retry-After header on rate limit.
- [x] 2.9 `app/api/favorites/[id]/route.ts`: DELETE awaits Next.js 16 async params, validates, calls `deleteFavorite(session.user.id, params.id)`. 401 / 400 / 204 / 404 per the proof.
- [x] 2.10 `lib/favorites/validators.test.ts`: 17 tests via `it.each` — accepts/rejects per `type` and `sport`, strict mode rejects extras, malformed metadata dates rejected, empty externalId/displayName rejected.
- [x] 2.11 `app/api/favorites/route.test.ts`: 8 tests covering GET (401, scoped list), POST (401, scoped 201, duplicate 200, bad type 400, bad sport 400, invalid JSON 400, 429 after 60 writes in fake-timer 60s window). `auth()` and queries module mocked via `vi.mock`.
- [x] 2.12 `app/api/favorites/[id]/route.test.ts`: 401, 204 happy path, 404 not-found.
- [x] 2.13 Migration applied to prod Neon. Verified: `favorites` table present alongside the 4 Auth.js tables; all 8 columns present; all 3 indexes present (pkey + unique-3col + user_id idx).
- [x] 2.14 Cross-user DELETE test case in `[id]/route.test.ts`: user A trying to DELETE a row owned by user B → 404; the same id deleted as user B → 204. Mock asserts the queries call was scoped to the calling user's id. **Closes audit finding F1.**

---

### [x] 3.0 Build the mobile-first Favorites UI: typeahead search/browse + "My Favorites" screen + bottom navigation

#### 3.0 Proof Artifact(s)

- Screenshot: `/favorites` at 375 px with typeahead showing one result of each type with Add CTAs.
- Screenshot: `/my-favorites` at 375 px listing one of each of the four favorite types.
- Screenshot: `/my-favorites` empty state at 375 px.
- Test: `app/(app)/favorites/page.test.tsx` — asserts type-labeled results, 44 px Add CTAs, optimistic Add transition.
- Test: `app/(app)/my-favorites/page.test.tsx` — asserts persisted-type rendering + Remove + empty state.
- Test: `components/bottom-nav.test.tsx` — asserts 3 items, 44 px each, active-route highlighting.
- Live URL walkthrough (mobile → desktop): add favorites on one device → sign out → sign in on second device → see the same favorites.

#### 3.0 Tasks

- [x] 3.1 `app/(app)/layout.tsx`: server component, calls `await auth()`, redirects to `/signin` on null, renders children + `<BottomNav />`. `pb-20` reserves space for the fixed nav.
- [x] 3.2 `components/bottom-nav.tsx`: client component (uses `usePathname`). Three items (Home / Favorites / My Favorites), each `min-h-11 min-w-11`, active state via `aria-current="page"` + bg-foreground/text-background class. Fixed at bottom with safe-area-inset padding.
- [x] 3.3 Moved `app/home/page.tsx` + test into `app/(app)/home/` via `git mv` (rename tracked). Left local `auth()` gate in place as defense-in-depth (existing tests still pass — 5/5).
- [x] 3.4 Middleware matcher now: `["/home/:path*", "/favorites/:path*", "/my-favorites/:path*"]`. Live verified — all three gated routes return 307 to `/signin?callbackUrl=...`.
- [x] 3.5 `app/api/favorites/search/route.ts`: GET `?q=&sport=`, auth-gated, `Promise.allSettled` against `searchTeams` + `searchAllLeagues` across all 4 sports (or just the filter), plus event-catalog search + sport-name match. Type-labeled results capped at 10 per section. Added `lib/events-catalog.ts` with 6 v1 tournament instances.
- [x] 3.6 `app/(app)/favorites/page.tsx` (server component shell) + `components/favorites-search.tsx` (client typeahead, 300 ms debounce, AbortController on every keystroke, min-h-11 input, "keep typing" hint under 2 chars). Passes the user's existing favorite keys so each result row's Add button starts in the right state.
- [x] 3.7 `components/favorite-add-button.tsx`: optimistic Add/Added with `aria-pressed`. POST to `/api/favorites`. Rolls back + shows non-technical inline alert on failure (special-case copy for 429). 44×44 target. Note: kept "Added" as a disabled state with descriptive aria-label rather than auto-toggling to Remove (the spec puts removal on the My Favorites screen).
- [x] 3.8 `app/(app)/my-favorites/page.tsx`: server component reading `listFavoritesForUser(session.user.id)`. Groups by `type` (Teams / Leagues / Sports / Tournaments) in fixed order. Empty state links back to `/favorites`.
- [x] 3.9 `components/favorite-remove-button.tsx`: DELETE to `/api/favorites/[id]`, calls `router.refresh()` on success so the server-component list updates. Non-technical inline alert on failure.
- [x] 3.10 `components/bottom-nav.test.tsx`: 5 tests — render order/hrefs, 44 px on all items, active route via `aria-current="page"`, sub-path matching (`/favorites/abc`), active-class visual treatment.
- [x] 3.11 Authored `app/(app)/favorites/page.test.tsx` (4 tests for the page shell — passes existing-favorites keys correctly, scopes by session.user.id, null-session returns null) plus `components/favorites-search.test.tsx` (3 tests — no-fetch under 2 chars, type-labeled results render with 44 px Add CTAs, initialFavorites pre-marks rows as Added) plus `components/favorite-add-button.test.tsx` (5 tests — initial state, POST behavior, 429 error mapping, touch target).
- [x] 3.12 `app/(app)/my-favorites/page.test.tsx`: 4 tests — empty state with `/favorites` link, all 4 type sections render when populated, scoped query, returns null on missing session.

---

### [x] 4.0 Build the server-side homepage data flow: window query, favorite-driven match fetch, dedup, and per-source caching

#### 4.0 Proof Artifact(s)

- File diff: `app/api/home/route.ts`, `lib/home/aggregator.ts`, `lib/home/cache.ts` present.
- Test: `app/api/home/route.test.ts` — 401, empty-favorites returns empty envelope, mixed favorites returns kickoff-sorted results, dedup, partial-failure envelope.
- Test: `lib/home/aggregator.test.ts` — fixture-driven across all four sports.
- CLI: live `curl -b 'session=...'` against the dev server returns the typed JSON envelope; `curl` without a cookie returns 401.

#### 4.0 Tasks

- [x] 4.1 `lib/home/aggregator.ts`: `aggregateMatchesForUser(userId, dates, fetcher)` plans unique (sport × date) calls, runs them with `Promise.allSettled`, dedups via `matchFavoritesAgainstMatches`, partitions by `dateUtc`, sorts each day by `kickoffUtc`. Also exports a pure `buildHomeEnvelope` for tests. `fetcher` is dependency-injected so tests don't touch the network.
- [x] 4.2 `lib/home/cache.ts`: two `unstable_cache` wrappers — 30 s for "today" (matches the 60 s client poll cadence) and 600 s for "yesterday"/"tomorrow". `makeCachedEventsDayFetcher(dates)` returns the right one per date.
- [x] 4.3 `app/api/home/route.ts`: GET, auth-gated, parses `?dates=yyyy-mm-dd,yyyy-mm-dd,yyyy-mm-dd` (strict regex), invokes the aggregator with the cached fetcher. 401 / 400 / 200 (even on `source.ok === false`).
- [x] 4.4 `lib/home/aggregator.test.ts`: 7 tests — zero-favorites short-circuit, minimum-query-set planning, partition/sort across all 4 sports, dedup (Team + League → 1), partial-failure envelope with `source.errors`, outside-window matches ignored, `buildHomeEnvelope` no-kickoff sort.
- [x] 4.5 `app/api/home/route.test.ts`: 6 tests — 401 no session, 400 missing dates, 400 malformed dates, 400 wrong number of parts, 200 + empty envelope for zero favorites, 200 + `source.ok=false` partial-failure passthrough. Asserts `aggregateMock` called with `(session.user.id, dates, fn)`.
- Also: added `.$type<Sport>()` to `favorites.sport` so the schema's column type narrows from `string` to `Sport`, matching the matcher's `Favorite` interface (no migration needed — it's a TS-side narrowing of the existing `text` column).

---

### [x] 5.0 Build the mobile-first homepage UI: day groups, match cards (Final / Live / Upcoming), and empty/error states

#### 5.0 Proof Artifact(s)

- Screenshot: `/home` at 375 px with ≥1 card under Yesterday / Today / Tomorrow.
- Screenshot: `/home` at 1280 px with the multi-column grid.
- Screenshot: a card in the **Live** state with score + minute/period/set.
- Screenshot: an **Upcoming** card with kickoff time, competition, round, venue, broadcast.
- Screenshot: "No matches in your window" empty state at 375 px.
- Screenshot: partial-error banner state at 375 px.
- Test: `app/(app)/home/page.test.tsx` — all three day groups, empty state, error banner.
- Test: `components/match-card.test.tsx` — Final/Live/Upcoming branches, long-name truncation, 44 px on interactives.

#### 5.0 Tasks

- [x] 5.1 Rewrote `app/(app)/home/page.tsx` as the thin server-component shell (auth gate + load favorites + header copy + page metadata) that embeds `<HomeClient hasFavorites={...} />`. Deleted the spec-01 placeholder copy and `AccountMenu` block.
- [x] 5.2 Implemented `components/home-client.tsx`: computes the date window via `lib/date-window.ts` in the browser TZ, fetches `/api/home?dates=...` on mount with an `AbortController`, renders the error banner when `source.ok === false`, the three `<DaySection />`s in order when matches exist, the `<NoMatchesEmptyState />` when the user has favorites but no matches in window, and a "no favorites yet" prompt linking to `/favorites` otherwise. Polling is intentionally deferred to Task 6.0.
- [x] 5.3 Implemented `components/day-section.tsx`: sticky day header ("Yesterday" / "Today" / "Tomorrow" + dated subtitle) + `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` of `<MatchCard />`. Empty days fall back to an inline "No matches." line so the section still anchors the layout.
- [x] 5.4 Implemented `components/match-card.tsx` with three branches keyed off `match.status`: Final (muted "Final" + scores), Live (pulsing "LIVE" pill + scores + `liveProgress`), Upcoming (clock icon + locale-formatted kickoff + venue/broadcast). Long names use `truncate` with `title`. Uniform card height via `min-h-32`.
- [x] 5.5 Implemented `components/no-matches-empty-state.tsx` (44 px CTA back to `/favorites`) and `components/data-source-error-banner.tsx` (role="alert" with pluralized failure count) as small presentational components.
- [x] 5.6 Authored `components/match-card.test.tsx`: 5 tests — Final branch + scores, Live branch + progress, Upcoming branch + broadcast, long-name truncation via `title`, uniform `min-h` assertion.
- [x] 5.7 Rewrote `app/(app)/home/page.test.tsx` (4 tests): redirects when no session, redirects when session.user has no id, renders the header + embeds `<HomeClient />` with `hasFavorites=false`, passes `hasFavorites=true` and calls `listFavoritesForUser(session.user.id)` when favorites exist. `HomeClient` is mocked to a stub so the page test stays focused on the shell.
- [x] 5.8 Authored `components/home-client.test.tsx` (4 tests): per-day rendering when matches exist, no-matches empty state when `hasFavorites=true`, no-favorites prompt when `hasFavorites=false`, data-source error banner with failure-count copy when `source.ok=false`. Polling/visibility tests remain Task 6.0.

---

### [ ] 6.0 Live auto-refresh + Page Visibility gating + deploy + cross-device end-to-end proof

#### 6.0 Proof Artifact(s)

- Test: `components/home-client.test.tsx` (extended) passes — uses `vi.useFakeTimers()` to assert: (a) 60 s polling fires while ≥1 in-progress card is present; (b) polling stops when none; (c) polling pauses on `visibilitychange → hidden` and resumes on `→ visible`; (d) an in-flight fetch is aborted on unmount.
- Live URL: production `https://score-mate-chi.vercel.app/home` returns 200 for a signed-in user; `/api/home?dates=...` returns the typed envelope.
- Live URL walkthrough: on a real mobile device during a real in-progress match (or a temporarily-injected live fixture), leaving the page open for 60+ seconds shows the live score update without a page reload.
- Screenshot: production `/home` at 375 px with ≥1 card under each day.
- DB evidence (sanitized): `SELECT type, count(*) FROM favorites WHERE user_id = '<id>' GROUP BY type` against prod Neon shows ≥1 favorite of each of the four types.

#### 6.0 Tasks

- [ ] 6.1 Extend `components/home-client.tsx` with `setInterval`-based 60 s polling that's gated on "the current rendered response contains at least one match with `status === 'live'`."
- [ ] 6.2 Add a `visibilitychange` listener: pause polling and abort any in-flight fetch when `document.visibilityState !== 'visible'`; resume when it returns to `'visible'`.
- [ ] 6.3 Cancel in-flight fetches via `AbortController` on unmount (`useEffect` cleanup) and on visibility-hidden transitions.
- [ ] 6.4 Extend `components/home-client.test.tsx` with the four polling assertions in the proof; use `vi.useFakeTimers()` and `dispatchEvent(new Event('visibilitychange'))` to drive the conditions.
- [ ] 6.5 Local manual end-to-end: sign in, favorite one of each type via `/favorites`, see them on `/my-favorites`, see real matches (or fixture-injected) on `/home`.
- [ ] 6.6 Commit per parent task throughout (or one final commit if you've been batching); push to `main`; verify the CI run goes green.
- [ ] 6.7 Verify Vercel auto-deploys; check the production URL responds 200 / the gated routes 307 the right way.
- [ ] 6.8 Real-device test on a phone: sign in, favorite a team, observe matches on `/home`. Capture the production-mobile screenshot for the proof.
- [ ] 6.9 Run the sanitized prod DB query and capture the per-type favorites count.
- [ ] 6.10 Update `README.md` if any new env vars were introduced (none expected by the spec).
