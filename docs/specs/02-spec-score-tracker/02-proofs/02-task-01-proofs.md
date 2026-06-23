# Task 01 Proofs — TheSportsDB client, sport allowlist, and favorite-matching primitives (lib-only)

## Task Summary

This task proves the entire pure-function foundation of the score-tracker is in place: a typed wrapper around TheSportsDB's free-tier endpoints (`lib/sportsdb/`), a normalized internal `Match`/`Team`/`League`/`Favorite` type system, the spec's curated Sport-favorite allowlist (`lib/sport-allowlist.ts`), a favorite-matcher that implements all four favorite-type semantics with dedup and Event silent-expire (`lib/favorite-matcher.ts`), and a timezone-correct date-window helper (`lib/date-window.ts`). 43 new tests pin every behavior; no DB, no UI, no network calls in test runs.

## What This Task Proves

- TheSportsDB client builds correct URLs for all five spec-listed endpoints and parses every sport's fixture into the internal `Match` shape.
- Status parsing maps TheSportsDB's varied status strings ("Match Finished", "In Play", "Not Started") onto the internal `final | live | upcoming` union.
- Score parsing returns `undefined` for upcoming matches even if the source returns `null` strings.
- The Sport allowlist contains every league/tournament the spec calls out, with TheSportsDB league IDs where stable and substring fallbacks for NCAA + tennis cases.
- `matchesSportAllowlist` accepts in-list leagues and **rejects out-of-list leagues for every supported sport** (closes audit finding F2 at the matcher level).
- `matchFavoritesAgainstMatches` implements all four favorite-type semantics correctly: Team (home OR away), Sport (via allowlist), League (by id), Event (id match AND date within `[startDate, endDate]` from metadata).
- Event "silent-expire" is enforced: an Event favorite whose stored date window has passed (or whose metadata is missing) contributes zero matches even when the event id would otherwise match.
- Dedup by `match.id` is enforced: a match claimed by Team + League + Sport favorites simultaneously appears once.
- `computeDateWindow` is timezone-correct across `America/New_York` late-evening edges, `Pacific/Kiritimati` (+14) early-morning edges, DST spring-forward day, leap-year boundary, and zero-padded output format.
- All five quality gates stay green (`format:check`, `lint`, `typecheck`, `test:ci`, `build`); test count grew from 26 → 69.

## Evidence Summary

- `pnpm test:ci`: **Test Files 11 passed (11); Tests 69 passed (69)**.
- 43 of those 69 tests are new in this task across 4 new test files.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: all clean.
- `pnpm build`: compiles successfully; route list unchanged from spec 01 baseline (no new routes in this task by design).

---

## Artifact 1 — File inventory

**What it proves:** Every artifact the task specified is in place at the canonical path.

**Why it matters:** A reviewer can scan one listing and confirm the spec-mandated layout matches before reading any code.

**Command:**

```bash
find lib -maxdepth 3 -type f \( -name "*.ts" -o -name "*.json" \) | sort
```

**Result summary:** All Task 1.0 files present alongside the spec-01 lib code, organized exactly per the Relevant Files table.

```text
lib/date-window.test.ts
lib/date-window.ts
lib/favorite-matcher.test.ts
lib/favorite-matcher.ts
lib/sport-allowlist.test.ts
lib/sport-allowlist.ts
lib/sportsdb/__fixtures__/eventsday-american-football.json
lib/sportsdb/__fixtures__/eventsday-basketball.json
lib/sportsdb/__fixtures__/eventsday-soccer.json
lib/sportsdb/__fixtures__/eventsday-tennis.json
lib/sportsdb/__fixtures__/search-all-leagues-soccer.json
lib/sportsdb/__fixtures__/searchteams.json
lib/sportsdb/client.test.ts
lib/sportsdb/client.ts
lib/sportsdb/types.ts
(...spec-01 lib code unchanged)
```

---

## Artifact 2 — TheSportsDB client: URL builders + fixture parsing (15 tests)

**What it proves:** Every endpoint the spec lists is wrapped in a typed, server-only function that builds the correct URL and parses the response into the internal `Match`/`Team`/`League` shapes. URL-encoding is correct for sports with spaces ("American Football") and for query strings with spaces ("Team USA"). Final/live/upcoming status branches are covered for every sport's fixture. Error path (non-OK status) throws.

**Why it matters:** Establishes the single boundary at which TheSportsDB's idiosyncratic response shapes are translated into the rest of the app's internal model. If we ever swap data providers, only this file changes.

**Artifact paths:** `lib/sportsdb/client.ts`, `lib/sportsdb/client.test.ts`, `lib/sportsdb/__fixtures__/*.json`

**Result summary:** 15/15 tests pass.

```text
 ✓ lib/sportsdb/client.test.ts (15 tests) 7ms
   ✓ buildEventsDayUrl(date, sport)
   ✓ URL-encodes the sport name (American Football)
   ✓ buildEventsNextUrl(teamId)
   ✓ buildEventsLastUrl(teamId)
   ✓ buildSearchTeamsUrl(query) URL-encodes spaces
   ✓ buildSearchAllLeaguesUrl(sport) URL-encodes spaces
   ✓ Soccer fixture: parses 'final' and 'live' with scores + progress
   ✓ American Football fixture: 'upcoming' has no score
   ✓ Basketball fixture: 'final' with both scores
   ✓ Tennis fixture: 'live' with set progress
   ✓ returns [] when API responds events: null
   ✓ throws when upstream returns non-OK
   ✓ searchTeams maps RawTeam[] → Team[]
   ✓ searchTeams returns [] on teams: null
   ✓ searchAllLeagues maps RawLeague[] → League[] with normalized sport
```

---

## Artifact 3 — Sport allowlist: shape + per-sport accept/reject (12 tests)

**What it proves:** The spec's curated allowlist is encoded for every supported sport with at least one entry each; every entry has either a `leagueId` or a `leagueNameContains` fallback. `matchesSportAllowlist` correctly accepts in-list leagues (Premier League / UEFA Euro / NFL / NBA / Wimbledon) and rejects out-of-list ones (Championship / XFL / EuroLeague / ATP 250).

**Why it matters:** The allowlist is the load-bearing piece that keeps the spec's Non-Goal #8 ("no sport-wide 'all matches' favoriting") honest. Every Sport favorite query funnels through this function.

**Artifact paths:** `lib/sport-allowlist.ts`, `lib/sport-allowlist.test.ts`

**Result summary:** 12/12 tests pass.

```text
 ✓ lib/sport-allowlist.test.ts (12 tests) 5ms
   ✓ has at least one entry for each supported sport
   ✓ every entry has either a leagueId or a leagueNameContains
   ✓ Soccer: accepts Premier League (by id)
   ✓ Soccer: accepts UEFA Euro (by name substring)
   ✓ Soccer: REJECTS Championship
   ✓ American Football: accepts NFL (by id)
   ✓ American Football: rejects XFL
   ✓ Basketball: accepts NBA (by id)
   ✓ Basketball: rejects EuroLeague
   ✓ Tennis: accepts Wimbledon (by name substring)
   ✓ Tennis: rejects ATP 250
   ✓ rejects matches whose sport doesn't match the requested sport
```

---

## Artifact 4 — Favorite-matcher: all four semantics + dedup + silent-expire (10 tests, closes F2)

**What it proves:** The matcher implements every favorite-type semantic the spec requires:

- **Team**: home OR away.
- **Sport**: only when `matchesSportAllowlist` returns true (the explicit "REJECTS EFL Championship" test **closes audit finding F2**).
- **League**: by `leagueId`.
- **Event**: by `eventInstanceId` AND `dateUtc ∈ [startDate, endDate]`; expired or missing-metadata Event favorites contribute zero matches (silent-expire).
- **Dedup**: a match claimed by Team + League + Sport favorites simultaneously appears exactly once.

**Why it matters:** This function is the entire input contract for the homepage data flow (Task 4.0). A regression here would either hide matches the user expects or surface noise the spec forbids.

**Artifact paths:** `lib/favorite-matcher.ts`, `lib/favorite-matcher.test.ts`

**Result summary:** 10/10 tests pass; includes the explicit F2-closeout case for Sport-favorite allowlist enforcement.

```text
 ✓ lib/favorite-matcher.test.ts (10 tests) 5ms
   ✓ Team: matches home OR away
   ✓ Sport: accepts Premier League for Sport=Soccer
   ✓ Sport: REJECTS English Championship for Sport=Soccer (closes F2)
   ✓ Sport: rejects cross-sport match
   ✓ League: matches by leagueId
   ✓ Event: matches inside the date window
   ✓ Event: silent-expire after end date
   ✓ Event: no metadata → no match (silent-expire)
   ✓ Dedup: claimed by Team+League+Sport → appears once
   ✓ Empty when no favorite claims any match
```

---

## Artifact 5 — Date-window helper: timezone-correct across edge cases (6 tests)

**What it proves:** `computeDateWindow` correctly produces YYYY-MM-DD strings in the requested IANA timezone, handling:

- UTC noon boring case.
- `America/New_York` at 23:30 local (UTC 03:30 next day) — today still reads `06-22` locally.
- `Pacific/Kiritimati` (+14) at 00:30 local — already a day ahead of UTC.
- DST spring-forward day (2026-03-08 in `America/New_York`).
- Leap-year boundary (2028-02-29).
- Zero-padded format (`2026-01-05`, not `2026-1-5`).

**Why it matters:** The spec mandates: "compute the window in the browser using `Intl.DateTimeFormat().resolvedOptions().timeZone`; the server must not assume a timezone." If this function is wrong, every user in a non-UTC timezone sees the wrong day's matches at the day boundary.

**Artifact paths:** `lib/date-window.ts`, `lib/date-window.test.ts`

**Result summary:** 6/6 tests pass.

```text
 ✓ lib/date-window.test.ts (6 tests) 64ms
   ✓ UTC noon
   ✓ America/New_York 23:30 local
   ✓ Pacific/Kiritimati 00:30 local
   ✓ DST spring-forward day
   ✓ Leap-year boundary
   ✓ zero-padded YYYY-MM-DD format
```

---

## Artifact 6 — Full quality-gate run

**What it proves:** Lint, format, typecheck, test, build all pass with the new code in place. Test count grew from 26 (end of spec 01) to 69.

**Commands:**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
```

**Result summary:** All five gates green; production build emits the same route map as spec 01 (no new routes in this task by design — Task 1.0 is lib-only).

```text
$ pnpm format:check
All matched files use Prettier code style!

$ pnpm lint    (clean)
$ pnpm typecheck    (clean)

$ pnpm test:ci
 Test Files  11 passed (11)
      Tests  69 passed (69)

$ pnpm build
✓ Compiled successfully
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /auth/error
├ ○ /check-email
├ ƒ /home
└ ○ /signin
ƒ Proxy (Middleware)
```

---

## Notes for Reviewers

- **TheSportsDB league IDs**: where the spec's curated allowlist names a league with a stable id (Premier League = 4328, NFL = 4391, NBA = 4387, etc.), the allowlist uses the id directly. For competitions whose source naming is fuzzier (UEFA Euros across seasons, ATP/WTA tour events, NCAA Top-25 matchups, college bowl games), the allowlist uses `leagueNameContains` substring matching as a pragmatic v1 fallback. IDs may need verification once the live integration in Task 4.0 hits real data; this is noted in `lib/sport-allowlist.ts`'s doc comment.
- **No network in test runs**: every test that exercises the client mocks `fetch` via the `ClientOptions.fetchFn` parameter and feeds in committed JSON fixtures. CI never touches TheSportsDB.
- **No UI / DB in this task**: Task 1.0 is intentionally pure-function-only. The DB schema for favorites lands in Task 2.0; the search/browse and homepage UIs land in Tasks 3.0 and 5.0.

## Reviewer Conclusion

The pure-function foundation is in place and exhaustively tested: TheSportsDB client wraps every required endpoint, the Sport allowlist + matcher implement the spec's four favorite-type semantics with explicit anti-leak coverage for Sport favorites (F2 closed), Event silent-expire is enforced, the date window is timezone-correct across edge cases, and every quality gate stays green. Task 2.0 (DB + API) is unblocked.
