# 03 Questions Round 1 — ESPN Backend Replacement

Please answer each question (select one or more options, or add notes). Feel free to expand under any question.

> **Terminology note:** The codebase currently calls TheSportsDB (`thesportsdb.com` free tier) via `lib/sportsdb/client.ts`. The request says "scoreDB" — I'm assuming that means TheSportsDB. If you actually meant a different provider, please correct in Q1 (E).

---

## 1. Provider being replaced

Confirm the source we are unplugging.

- [X] (A) TheSportsDB free tier (the `https://www.thesportsdb.com/api/v1/json/3` calls in `lib/sportsdb/client.ts`). Replace it entirely.
- [ ] (B) TheSportsDB but keep it as a fallback when ESPN doesn't cover a sport/league (e.g. tennis).
- [ ] (C) A different provider — please describe in notes.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**
- The stated goal is "unplug" the old backend; keeping two providers doubles the surface area and the test matrix.
- ESPN coverage gaps (tennis especially) are better handled by narrowing supported sports (see Q3) than by maintaining a dual-source aggregator.
- If ESPN turns out to be insufficient, we can revisit a fallback in a follow-up spec rather than designing for it now.

---

## 2. ESPN API entry point

The repo you linked (`pseudo-r/Public-ESPN-API`) documents the unofficial **`site.api.espn.com/apis/site/v2/sports/{sport}/{league}/...`** endpoints (no key, no rate-limit headers, JSON). It also lists `sports.core.api.espn.com` for deeper data.

- [ ] (A) Use only the `site.api.espn.com` "site v2" endpoints (scoreboard, teams, team schedule). Simpler, mirrors what TheSportsDB gave us.
- [X] (B) Use a mix of `site.api.espn.com` (scoreboard/teams) and `sports.core.api.espn.com` (deeper detail like venue/broadcast when missing from site).
- [ ] (C) Use only `sports.core.api.espn.com`. More uniform, but heavier per-event detail fetches.
- [ ] (D) Other (describe)

**Current best-practice context:** The `site.api.espn.com` endpoints are what powers ESPN's own scoreboard widgets and return everything we currently surface (teams, scores, status, kickoff, broadcast, venue) in one call. `sports.core.api.espn.com` returns HATEOAS-style `$ref` links that require an extra round-trip per field — fine for backfill, painful for the homepage hot path.

**Why these are recommended:** [(A)]
- Matches the data shape we already render, so the swap stays small.
- One call per (league, date) keeps the aggregator's fan-out comparable to today.
- (B) is a reasonable later optimization if a needed field is missing; we'd rather discover that gap as a follow-up than design for it speculatively.

---

## 3. Sport & league coverage

ESPN's URL shape is `/{sport}/{league}` — there is **no "all soccer leagues at once" endpoint**. We must enumerate the leagues we care about. Today we support four sports (`Soccer`, `American Football`, `Basketball`, `Tennis`).

For each sport, which leagues should v1 include?

- [X] (A) **American Football:** `football/nfl` + `football/college-football` (NCAA FBS).
- [X] (B) **American Football:** `football/nfl` only (drop college for v1).
- [X] (C) **Basketball:** `basketball/nba` + `basketball/wnba` + `basketball/mens-college-basketball`.
- [ ] (D) **Basketball:** `basketball/nba` only.
- [] (E) **Soccer:** the "big five" — `eng.1`, `esp.1`, `ita.1`, `ger.1`, `fra.1` — plus `usa.1` (MLS), `uefa.champions`, `uefa.europa`, `fifa.world`.
- [X] (F) **Soccer:** broader set (specify in notes, e.g. add domestic cups, MLS playoffs, Copa Libertadores).
- [X] (G) **Tennis:** ESPN's tennis coverage on the public endpoints is sparse / inconsistent (`tennis/atp`, `tennis/wta` exist but per-tournament). **Drop Tennis** from v1 supported sports.
- [ ] (H) **Tennis:** keep Tennis, accept gaps, surface "no matches" gracefully.
- [ ] (I) Other (describe per-sport)

**Recommended answer(s):** [(A), (C), (E), (G)]

**Why these are recommended:**
- (A) + (C) match how ESPN itself groups marquee North American leagues; same set that today's TheSportsDB league favorites typically point at.
- (E) is the smallest soccer set that covers what the existing events catalog (World Cup, Euros, etc.) and most user favorites would reasonably want, without overcommitting to leagues whose data quality varies.
- (G) — dropping Tennis — is recommended because ESPN's tennis API is per-tournament and not a clean league-scoreboard model. Keeping Tennis would force a parallel "tournaments" pipeline just for one sport, which violates the small-slice principle. If tennis is important, treat it as its own follow-up spec.
- (F) and (H) remain valid product calls; we just want to make them explicit rather than implicit.

---

## 4. Migration of existing user favorites

The `favorites` table stores `external_id` as TheSportsDB ids (e.g. team `idTeam`, league `idLeague`, event catalog slug, or the canonical sport name for `type='sport'`). ESPN uses different ids (e.g. team id `12` for Indianapolis Colts is ESPN's, not TheSportsDB's `idTeam`).

How should we handle existing rows on cutover?

- [ ] (A) **One-shot translation migration.** Write a script that maps every existing TheSportsDB id to its ESPN equivalent (team-by-team, league-by-league) and rewrites `favorites.external_id`. Best-effort: rows that can't be mapped are flagged and surfaced to the user as "needs reselection."
- [ ] (B) **Dual-id columns.** Add `external_id_espn` next to `external_id`. Aggregator reads ESPN ids when present, otherwise tries to backfill on read.
- [] (C) **Wipe and re-add.** Truncate `favorites` for all users; ask them to re-favorite from the new search. Simplest code, worst UX.
- [X] (D) **There are no real users yet.** Just drop and recreate; no migration needed.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(D) if true, otherwise (A)]

**Why these are recommended:**
- (D) is by far the cleanest if score-mate is still pre-launch / single-user (you). The repo's recency (`01-spec-auth-foundation`, `02-spec-score-tracker` only just landed) suggests this is likely.
- If there *are* real users, (A) preserves their work. The mapping table can be built once from ESPN's `/teams` and `/scoreboard` endpoints — finite work, no ongoing complexity.
- (B) leaves the schema permanently bilingual and is worth avoiding unless we expect to keep both providers.
- (C) is a UX cliff and should only be acceptable if (D) is true anyway.

---

## 5. Search behavior (typeahead on the Favorites screen)

ESPN has **no public team/league search endpoint**. We currently call `searchteams.php` and `search_all_leagues.php` on TheSportsDB.

- [X] (A) **Snapshot catalogs.** At build time (or via a committed JSON), fetch `/{sport}/{league}/teams` for every supported league and store a local team+league catalog. Search becomes an in-memory substring match. Refresh quarterly via a script.
- [ ] (B) **Runtime catalog fetches with cache.** On first search per process, hit `/{sport}/{league}/teams` for each supported league, cache for N hours, then substring-match against the cached set.
- [ ] (C) **Remove free-text search.** Replace the search box with a hierarchical picker (Sport → League → Team). No string search needed.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**
- ESPN team rosters change ~once a year. A committed JSON snapshot is the simplest, fastest, and cheapest option, and it makes the search behavior fully deterministic in tests.
- (B) adds a cold-cache latency cliff on the first search after each deploy / container restart for ~zero benefit over (A).
- (C) is a real UX regression vs. the current typeahead — recommended only if the user explicitly wants to simplify.

---

## 6. Caching & freshness

Today `lib/home/cache.ts` wraps fetchers with `unstable_cache` (keys `v2-utc`). ESPN's `scoreboard` endpoint changes every few seconds during live games.

- [ ] (A) Keep the existing cache TTLs and key strategy as-is, just point them at ESPN.
- [X] (B) Tighten TTL for "today" (e.g. 30s) and keep longer TTL for "yesterday" (e.g. 1h) and "tomorrow" (e.g. 5m).
- [ ] (C) Drop caching entirely for the homepage — let ESPN's CDN handle it.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(B)]

**Why these are recommended:**
- Today's matches benefit most from short TTL so scores look near-live; yesterday's matches are immutable and can be cached for an hour.
- (A) is safe but probably leaves live-score staleness on the table.
- (C) couples our UX to ESPN's CDN behavior, which we don't control or monitor.

---

## 7. Cutover strategy

How should the new client land?

- [X] (A) **Hard swap in one PR.** Delete `lib/sportsdb/`, add `lib/espn/`, update imports, ship. Trust the existing test suite + the new tests for the ESPN client.
- [ ] (B) **Feature flag.** Land both clients behind `process.env.DATA_PROVIDER=espn|sportsdb`, default to `sportsdb`, flip after manual verification.
- [ ] (C) **Branch coexistence.** Land ESPN as a new module without removing the old one; flip imports in a follow-up PR after a soak period.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**
- The internal `Match` / `Team` / `League` types are already provider-agnostic, so a hard swap is the smallest amount of code in the tree afterward.
- (B) is appropriate when there are real users we're worried about regressing; combine with answer (A) on Q4 if so.
- (C) leaves two providers in the repo indefinitely — exactly what the user said they want to avoid.

---

## 8. Proof artifacts

Which evidence will best demonstrate the swap works end-to-end? (Multi-select.)

- [X] (A) Screenshot of the homepage showing today's matches with live scores fetched from ESPN.
- [X] (B) `curl` capture of `/api/home?dates=...&tz=...` showing real ESPN-sourced data in the envelope.
- [X] (C) Test output: existing `aggregator.test.ts` / `route.test.ts` passing against the new ESPN-backed client (with fixtures recorded from real ESPN responses).
- [ ] (D) Diff showing `lib/sportsdb/` removed and `lib/espn/` added.
- [X] (E) Screenshot of the Favorites search showing ESPN-sourced teams/leagues in the typeahead.
- [ ] (F) Other (describe)

**Recommended answer(s):** [(A), (B), (C), (E)]

**Why these are recommended:**
- (A) + (E) prove the user-visible outcome.
- (B) proves the API contract is unchanged.
- (C) proves we didn't regress the matcher / bucketing logic.
- (D) is fine as supporting evidence but isn't an "outcome" artifact on its own.
