# 09-validation-home-feed-split.md

Validation of **Spec 09 — Home / Teams feed split** against its task list and proof artifacts.

## 1) Executive Summary

- **Overall: FAIL** — Gate A tripped (one **HIGH** issue).
- **Implementation Ready: No** — team functionality and player *display* are solid, but live **player search/discovery is non-functional** (the ESPN endpoint the code calls returns 404 for every league), so the Coco Gauff user story and Success Metric #3 cannot be met against real data; a working endpoint was identified during the 4.1 spike but not adopted.
- **Key metrics:**
  - Functional Requirements Verified: **21 / 22 (95%)** — 1 Failed (live athlete search), 0 Unknown.
  - Proof Artifacts working: **12 / 12 accessible**; 1 (player-search screenshot) is a static fixture that does not exercise the live path.
  - Files changed vs. planned scope: all mapped or linked; **no unmapped out-of-scope core changes**.
  - Quality gates: `lint` 0 errors (2 pre-existing warnings, untouched files), `format:check` ✓, `typecheck` ✓, `test:ci` **387 passed**, `build` ✓ (Success Metric #6 otherwise green).

### Gate results

| Gate | Result | Notes |
| --- | --- | --- |
| A — no CRITICAL/HIGH | **FAIL** | HIGH: live athlete search endpoint 404s (see Issue H-1). |
| B — no Unknown coverage entries | PASS | 0 Unknown. |
| C — proof artifacts accessible/functional | PASS (with note) | All present & tests pass; Unit 3 screenshot is a fixture, not the live path. |
| D — file integrity (tiered) | PASS | All core changes mapped; supporting files linked (see Appendix). |
| E — repository standards | PASS | strict TS, colocated Vitest, shared `lib/teams/types.ts` contract, conventional commits. |
| F — no secrets in proofs | PASS | Grep found no key/token/password/DSN strings. |

---

## 2) Coverage Matrix

### Functional Requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| **U1** `/teams` route under `(app)` auth guard | Verified | `app/(app)/teams/page.tsx` calls `auth()`+redirect; `page.test.tsx` redirect test passes (commit `8e2b5df`). |
| **U1** Nav: exactly 4 items Home·Teams·Favorites·Settings, inline SVG, no new dep | Verified | `components/bottom-nav.tsx` `NAV_ITEMS`; `TeamsIcon` inline in `nav-icons.tsx`; `bottom-nav.test.tsx` asserts 4 hrefs/order (7 tests pass). |
| **U1** ≥44px targets + `aria-current` | Verified | `min-h-11 min-w-11` on links; `bottom-nav.test.tsx` touch-target + active-item tests pass. |
| **U1** Teams empty state → link to `/favorites` | Verified | `TeamsEmptyState` ("Add a team or player" → `/favorites`); `page.test.tsx` empty-state test; screenshot `09-teams-empty.png`. |
| **U1** Teams loading state | Verified | `TeamsClient` renders "Loading teams…" (`teams-client.tsx`). |
| **U2** `GET /api/teams` auth-gated, returns entity + last/next match | Verified | `app/api/teams/route.ts` (401 when no session); `route.test.ts` happy-path asserts `lastMatch`/`nextMatch` shape (6 tests pass). |
| **U2** Team schedule from ESPN per-team endpoint; extract last/next | Verified | `teamScheduleForLeague` + `extractEntityMatches` (final→last, upcoming→next); route test with fixture. |
| **U2** Client fetches `/api/teams`, 60s poll, aborts on unmount/hide | Verified | `teams-client.tsx` `POLL_MS=60_000`, `visibilitychange`, `abort()`; `teams-client.test.tsx` mount-fetch + abort-on-unmount pass. |
| **U2** One entity card w/ name+badge, Last/Next rows, "No recent/upcoming" | Verified | `entity-card.tsx`; `entity-card.test.tsx` full/both-null/next-only pass; screenshot `09-teams-cards.png`. |
| **U2** `/api/home` excludes `team`+`player` favorites | Verified | `lib/home/aggregator.ts` `isLeagueFavorite` (`!== "team" && !== "player"`) in `planLeagueKeys`+`buildHomeEnvelope`; `aggregator.test.ts` exclusion + teams-only-empty tests pass. |
| **U2** Home empty state when only team/player favorites | Verified | `TeamsOnlyPrompt` (→ `/teams`) in `home-client.tsx`; `home-client.test.tsx` teams-only-prompt test passes. |
| **U3** DB migration extends `favorite_type` enum | Verified | `db/migrations/0004_optimal_matthew_murdock.sql` = `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'player'`; applied ("Migrations applied successfully"). |
| **U3** `/api/favorites/search` returns `type:"player"` results (per-sport, capped) | **Failed** | Wiring correct & unit-tested (mocked), but the endpoint `searchAthletes()` calls — `site.api.espn.com/.../{league}/athletes?search=` — returns **HTTP 404 for nba/nfl/eng.1/mlb** (live probe). Live search yields **zero** player results. See Issue **H-1**. |
| **U3** `"player"` added to `FavoriteType`/`FAVORITE_TYPES`/`favoriteTypeEnum` | Verified | `lib/sports/types.ts`, `db/schema/favorites.ts` updated; `typecheck` green. |
| **U3** `POST /api/favorites` accepts `type:"player"` | Verified | Validator derives from `FAVORITE_TYPES`; `favorites/route.test.ts` + `validators.test.ts` updated (player now valid). |
| **U3** Search UI shows "Players" section + label | Verified | `favorites-list.tsx` `SECTION_ORDER`/`SECTION_LABEL` "Players"; `favorites-search.tsx` `TYPE_LABEL.player="Player"`. |
| **U4** `/api/teams` handles `player` via athlete endpoints; same shape | Verified | Route player branch → `athleteSchedule(primaryLeagueKey, externalId)`; `route.test.ts` player-with-data + throws cases pass. |
| **U4** Teams renders players + teams in one list, `createdAt` desc | Verified | `listFavoritesForUser` `orderBy(desc(createdAt))`; route preserves order via `Promise.all`; `TeamsClient` renders flat grid. |
| **U4** Player card: name + last/next rows + graceful "No data" | Verified | `entity-card.tsx`; `entity-card.test.tsx` player-with-data + player-no-data pass. |
| **U4** ESPN unavailable → "Match data unavailable", never crashes | Verified | `athleteSchedule` catches all errors → `{null,null}`; card renders "Match data unavailable"; screenshot `09-player-card.png` (Alcaraz fallback). Live run resolved LeBron's last match. |
| **U4** Player schedule from ESPN athlete endpoint (best-effort) | Verified | `athleteSchedule` core-API eventlog + `$ref` resolution; live LeBron probe returned real `lastMatch`. |
| **Home-exclusion matcher correctness** | Verified | `lib/favorite-matcher.ts` adds `case "player": return false` (players never claim a home match). |

### Repository Standards

| Standard Area | Status | Evidence & Notes |
| --- | --- | --- |
| Coding standards (Next 16, strict TS, no `any`, Tailwind mobile-first) | Verified | Server components + `"use client"` only on `TeamsClient`; shared contract in `lib/teams/types.ts`; `pnpm lint`/`format:check` clean. |
| Testing patterns (Vitest + RTL, colocated) | Verified | New `*.test.tsx`/`*.test.ts` colocated; 387 tests pass. |
| Quality gates | Verified | lint/format/typecheck/test/build all exit 0 (Success Metric #6). |
| Documentation / proofs | Verified | Per-task proof docs with summary-first structure + inline screenshots. |
| Commit conventions | Verified | 4 conventional commits, each with `Related to T#.0 in Spec 09-...`. |

### Proof Artifacts

| Unit | Proof Artifact | Status | Result |
| --- | --- | --- | --- |
| U1 | `bottom-nav.test.tsx` (4 items) | Verified | 7 tests pass. |
| U1 | `app/(app)/teams/page.test.tsx` (empty state → /favorites) | Verified | 3 tests pass. |
| U1 | Screenshot `09-teams-empty.png` | Verified | File present; renders empty state + 4-item nav. |
| U2 | `app/api/teams/route.test.ts` (data contract) | Verified | 6 tests pass. |
| U2 | `lib/home/aggregator.test.ts` (team/player excluded) | Verified | 22 tests pass, incl. exclusion + teams-only-empty. |
| U2 | Screenshot `09-teams-cards.png` | Verified | File present; two team cards w/ Last/Next rows. |
| U3 | Migration `0004_..._add player` | Verified | File present; `ADD VALUE IF NOT EXISTS 'player'`; applied to dev DB. |
| U3 | `favorites/search/route.test.ts` (player result) | Verified (mocked) | 24 tests pass — but assert on a **mocked** `searchAthletes`; does not exercise live ESPN. |
| U3 | Screenshot `09-player-search.png` | Verified (fixture) | File present, but static fixture with query "lebron"; **does not demonstrate the live search path** (which 404s). See H-1. |
| U4 | `app/api/teams/route.test.ts` (player fixture) | Verified | player-with-data + throws cases pass. |
| U4 | `components/entity-card.test.tsx` | Verified | 5 tests (team + player + no-data) pass. |
| U4 | Screenshot `09-player-card.png` | Verified | File present; LeBron (data) + Alcaraz ("Match data unavailable"). |

---

## 3) Validation Issues

| Severity | Issue | Impact | Recommendation |
| --- | --- | --- | --- |
| **HIGH** (H-1) | **Live player search is non-functional.** `searchAthletes()` (`lib/espn/client.ts`) requests `https://site.api.espn.com/apis/site/v2/sports/{leagueKey}/athletes?search=`, which returns **HTTP 404** for `basketball/nba`, `football/nfl`, `soccer/eng.1`, and `baseball/mlb` (live `curl` probes, 2026-07-07). Because the function swallows errors and returns `[]`, `/api/favorites/search` yields **no player results** in production, so a user cannot discover/add a player via the UI. This blocks Spec Success Metric #3 and the "search & follow Coco Gauff" user story. Notably, the 4.1 spike (documented in `09-task-04-proofs.md`) found a **working** endpoint — `https://site.web.api.espn.com/apis/common/v3/search?query=gauff&type=player` returns "Coco Gauff" (re-verified live) — but it was not used for Unit 3's `searchAthletes`. | Functionality: the entire player-discovery path (Unit 3 FR2 / Metric #3) does not work against real ESPN; player favorites are only reachable by direct DB insertion. Player *display* (Unit 4) is unaffected. | Repoint `searchAthletes` (or add a new athlete-search function) at the working `site.web.api.espn.com/apis/common/v3/search?query=<q>&limit=&type=player` endpoint; map `items[]` → `{ id, displayName, sport }` (derive `sport`/`league` from each item's `sport`/`league` fields), keeping the per-call `try/catch`. Then re-capture `09-player-search.png` from the **live** typeahead (using "Gauff" per the spec) and update the `favorites/search/route.test.ts` fixture to the real response shape. |
| MEDIUM (M-1) | **Unit 3 search screenshot doesn't demonstrate the live feature.** `09-player-search.png` is rendered from a static dev fixture (`app/dev-fixture/player-search/page.tsx`, hardcoded "lebron" + fixed rows), not the live `FavoritesSearch` typeahead. Combined with H-1, the artifact gives a misleading impression that live player search works. | Verification: the proof for Metric #3 doesn't actually exercise the code path it claims. | After fixing H-1, replace with a screenshot of the real typeahead returning a player result; keep the fixture only if clearly labeled as illustrative. |
| LOW (L-1) | **Spec-internal contract naming inconsistency.** Unit 2's proof-artifact text (spec line 53) describes the response as `{ favorites: [{...}] }`, while Technical Considerations (line 126) and the implementation use `{ entities: [...] }` (`lib/teams/types.ts`). Implementation correctly follows the Technical Considerations contract. | Traceability only; no functional impact. | Optional: correct the spec's Unit 2 proof-artifact wording to `entities` for consistency. |
| INFO (I-1) | **Pre-existing migration snapshot repair.** `db/migrations/meta/0003_snapshot.json` had a duplicate `id` colliding with `0002`, blocking `db:generate`; it was re-chained with a fresh `id` (content unchanged, data-only `TRUNCATE`). Well-documented in `09-task-03-proofs.md`. No applied SQL altered. | None. | None — noted for reviewer awareness. |
| INFO (I-2) | **`lib/favorite-matcher.ts` not in planned "Relevant Files"** but changed (added exhaustive `case "player"`). Change is a required consequence of the new union member and the home-exclusion FR; linked via commit `5a06808`. | None (justified core change, linked). | None. |

---

## 4) Evidence Appendix

### Git commits analyzed (branch `feat/09-home-feed-split`, 4 commits ahead of `main`)

| Commit | Task | Scope |
| --- | --- | --- |
| `8e2b5df` | T1.0 | Teams shell, `TeamsIcon`, 4-item nav, `/teams` route + tests. |
| `9deb37e` | T2.0 | `EntityCard`, `TeamsClient`, `/api/teams`, home-feed exclusion, `TeamsOnlyPrompt`. |
| `5a06808` | T3.0 | `player` type + enum migration `0004`, `searchAthletes` + fan-out, list/search labels, matcher case, snapshot repair. |
| `d3d2071` | T4.0 | `athleteSchedule` (core-API eventlog), player branch in `/api/teams`, player card tests, fixture. |

### Commands executed (2026-07-07)

```text
pnpm lint         → exit 0 (0 errors, 2 pre-existing warnings in untouched files)
pnpm format:check → exit 0 ("All matched files use Prettier code style!")
pnpm typecheck    → exit 0
pnpm test:ci      → exit 0 (Test Files 41 passed; Tests 387 passed)
pnpm build        → exit 0 ("Compiled successfully"; 20/20 static pages)

# Live ESPN athlete-search probe (endpoint used by searchAthletes)
curl -o/dev/null -w %{http_code} .../sports/basketball/nba/athletes?search=james → 404
                                  .../sports/football/nfl/athletes?search=james  → 404
                                  .../sports/soccer/eng.1/athletes?search=james  → 404
                                  .../sports/baseball/mlb/athletes?search=james  → 404
# Working alternative (found in 4.1 spike, NOT used):
curl .../apis/common/v3/search?query=gauff&type=player → items[0].displayName = "Coco Gauff"

# Named proof-artifact tests
pnpm vitest run bottom-nav / teams/page / api/teams / aggregator / favorites/search / entity-card
  → 6 files, 67 tests passed
```

### File classification (Gate D)

- **Core, mapped to FRs:** `app/(app)/teams/page.tsx`, `app/(app)/home/page.tsx`, `app/api/teams/route.ts`, `app/api/favorites/search/route.ts`, `components/{bottom-nav,nav-icons,entity-card,teams-client,home-client,favorites-list,favorites-search}.tsx`, `lib/teams/types.ts`, `lib/espn/{client,catalog}.ts`, `lib/home/aggregator.ts`, `lib/sports/types.ts`, `lib/favorite-matcher.ts`, `db/schema/favorites.ts`, `db/migrations/0004_*.sql`.
- **Supporting, linked:** all `*.test.ts(x)`, `app/dev-fixture/{nav,player-search}/page.tsx` (screenshot fixtures), `db/migrations/meta/*` (drizzle bookkeeping), `docs/specs/09-.../*` (spec, tasks, audit, proofs).
- **Unmapped out-of-scope core changes:** none.

### Security (Gate F)

`grep -rniE "api[_-]?key|secret|password|token|bearer|postgres://|DATABASE_URL=" 09-proofs/*.md` → no matches. Screenshots show placeholder/public data only (no real user email/PII).

---

**Validation Completed:** 2026-07-07
**Validation Performed By:** Claude Opus 4.8
