# 03-validation-espn-backend.md

## 1) Executive Summary

- **Overall:** **PASS** — all required gates (A, B, C, D, E, F) pass.
- **Implementation Ready:** **Yes** — every spec FR maps to a Verified proof artifact; two visual artifacts (T5.3 homepage screenshot, T5.4 live-game observation) are explicitly deferred to user verification with documented reproduction recipes, which is acceptable because Success Metric §3 is a steady-state property and Success Metric §1/§2/§4/§5 are all evidenced independently.
- **Key metrics:**
  - Functional Requirements verified: **100%** (16/16)
  - Success Metrics verified: **4/5 by agent, 1/5 deferred to user (§3 live-score freshness)**
  - Proof artifacts working: **100%** (11/11 files exist; commands re-run successfully; no broken evidence)
  - Files changed vs expected: **30 core + supporting files changed across 5 commits, all mapped to FRs or task notes**

## 2) Coverage Matrix

### Functional Requirements

| Requirement ID/Name | Status | Evidence (file:lines, commit, or artifact) |
| --- | --- | --- |
| **Unit 1.FR-1** ESPN client public surface (`scoreboardForLeague`, `leagueTeams`, `teamScheduleForLeague`, sport/league discovery) | Verified | [lib/espn/client.ts](lib/espn/client.ts) added in `693f2df`; covered by [lib/espn/client.test.ts](lib/espn/client.test.ts) (22 tests, all green) |
| **Unit 1.FR-2** `lib/sports/types.ts` provider-neutral, `Sport` drops Tennis | Verified | [lib/sports/types.ts](lib/sports/types.ts) — `Sport = "Soccer" \| "American Football" \| "Basketball"`; Tennis removed in `9ed559e`; `tsc --noEmit` clean |
| **Unit 1.FR-3** Status mapping `pre`/`in`/`post` → `upcoming`/`live`/`final` with `liveProgress` from `shortDetail` | Verified | `lib/espn/client.test.ts` "NFL fixture: final/in-progress" tests pass |
| **Unit 1.FR-4** Site v2 hot path, `sports.core.api.espn.com` opt-in fallback only | Verified | `fetchEventCoreDetail` in [lib/espn/client.ts:316](lib/espn/client.ts:316) gated by a `sports.core.api.espn.com/` URL whitelist; rejection test in `client.test.ts` |
| **Unit 1.FR-5** Kickoff parsed directly into `kickoffUtc` (no Z workaround) | Verified | `client.test.ts` "EPL fixture: parses kickoff timestamp directly" asserts `kickoffUtc === "2026-03-08T16:30Z"` exact equality |
| **Unit 1.FR-6** `lib/sportsdb/` removed entirely | Verified | `git log --stat 693f2df^..HEAD` shows all 9 files under `lib/sportsdb/` deleted in `9ed559e`; residue grep returns zero hits |
| **Unit 2.FR-1** `SUPPORTED_LEAGUES` (2 football + 3 basketball + 14 soccer) | Verified | [lib/espn/leagues.ts](lib/espn/leagues.ts); `lib/espn/leagues.test.ts` asserts the 2/3/14 breakdown and Tennis absence |
| **Unit 2.FR-2** Aggregator fans out per-(leagueKey, date) across widened 5-date window | Verified | [lib/home/aggregator.ts:152](lib/home/aggregator.ts:152) `planLeagueKeys` + fan-out loop; `aggregator.test.ts` "fans out exactly (leagueKeys × 5 dates) calls" |
| **Unit 2.FR-3** `events-catalog.ts` entries use ESPN league keys | Verified | [lib/events-catalog.ts](lib/events-catalog.ts): `fifa-world-cup-2026 → "soccer/fifa.world"`, `nfl-super-bowl-lx → "football/nfl"`, etc.; Wimbledon/US Open Tennis entries removed; `events-catalog.test.ts` 11 tests pass |
| **Unit 2.FR-4** Local-date bucketing, dedup, partial-failure preserved | Verified | `aggregator.test.ts` covers each: "buckets by LOCAL date — UTC-tomorrow → local-today", "partial-failure: rejected upstream yields source.ok=false", "dedupes a match claimed by two favorites" |
| **Unit 3.FR-1** `scripts/refresh-espn-catalog.ts` operator-run, `--dry-run`, deterministic sort | Verified | [scripts/refresh-espn-catalog.ts](scripts/refresh-espn-catalog.ts); proof shows successful run producing 1,675 teams, 0 errors |
| **Unit 3.FR-2** Committed catalog ≥ 500 teams, three v1 sports | Verified | `node -e "..."` against [lib/espn/catalog.json](lib/espn/catalog.json): **1,675 teams, 19 leagues, sports = [American Football, Basketball, Soccer]** |
| **Unit 3.FR-3** Search route rewritten to in-memory catalog | Verified | [app/api/favorites/search/route.ts](app/api/favorites/search/route.ts) uses `searchCatalogTeams`/`searchCatalogLeagues`; `route.test.ts` (20 tests) covers all 8 anchor queries + composition |
| **Unit 3.FR-4** Per-category cap (10) and result order (sport, event, league, team) preserved | Verified | `route.test.ts` "each category is capped at 10 results" and "category ordering is sport, event, league, team" |
| **Unit 4.FR-1** Tiered TTLs (30s today / 3600s yesterday / 300s tomorrow), key prefix `v3-espn` | Verified | [lib/home/cache.ts:53](lib/home/cache.ts:53) `chooseRevalidate`; [lib/home/cache.test.ts](lib/home/cache.test.ts) 8 tests including widened-neighbor cases; prefix assertion `expect(CACHE_KEY_PREFIX).toBe("v3-espn")` |
| **Unit 4.FR-2** `TRUNCATE TABLE favorites` migration + README release note | Verified | [db/migrations/0003_reset_favorites_for_espn.sql](db/migrations/0003_reset_favorites_for_espn.sql); journal entry `idx: 3` registered; T4 proof records post-migration `favorites count: 0`; [README.md](README.md) "Release notes" section added |

### Success Metrics

| Metric | Status | Evidence |
| --- | --- | --- |
| §1 Zero `thesportsdb`/`lib/sportsdb` residue | Verified | `grep -rE "thesportsdb\|lib/sportsdb"` over `*.ts/*.tsx/*.json` (excluding `node_modules`, `.next`, `docs/specs`, `pnpm-lock.yaml`) returns **0 hits** |
| §2 Pre-existing tests still pass | Verified | `pnpm test:ci` → **241/241** tests pass; tests added not removed (was 210 pre-spec) |
| §3 Live-score freshness ≤ 30s | **Deferred** | Steady-state property; documented reproduction recipe in [03-task-05-proofs.md](docs/specs/03-spec-espn-backend/03-proofs/03-task-05-proofs.md#t54--live-in-progress-game-observation-success-metric-3). Tiered cache config provably has 30s TTL for today (FR-1 verified) |
| §4 Breadth: 8 anchor queries return ≥ 1 result | Verified | [05-breadth.txt](docs/specs/03-spec-espn-backend/03-proofs/05-breadth.txt): all 8/8 hit; reproduced live by validation |
| §5 CI gates green | Verified | [05-ci-gates.txt](docs/specs/03-spec-espn-backend/03-proofs/05-ci-gates.txt) + re-run: lint, format:check, typecheck, test:ci (241/241), build (13 routes) all pass |

### Repository Standards

| Standard Area | Status | Evidence & Compliance Notes |
| --- | --- | --- |
| Next.js 16 App Router only | Verified | All new route handlers under `app/api/**`; no Pages Router files added |
| TypeScript strict, no `any` / `@ts-ignore` | Verified | `pnpm typecheck` (strict) clean; spot-check of `lib/espn/`, `lib/home/`, `app/api/favorites/search/` shows no `any`, no `@ts-ignore`, no `@ts-expect-error` |
| Drizzle schema/migration layout | Verified | New migration `db/migrations/0003_reset_favorites_for_espn.sql` + journal entry; no schema-file changes (data-only migration) |
| Colocated `*.test.ts(x)` | Verified | Every new test file sits next to its source: `lib/espn/{client,leagues,catalog}.test.ts`, `lib/home/cache.test.ts`, `app/api/favorites/search/route.test.ts` |
| Vitest + RTL | Verified | All new tests use `vitest`; no foreign test runner introduced |
| ESLint + Prettier | Verified | `pnpm lint` and `pnpm format:check` both clean |
| Conventional Commits with SDD task ref in body | Verified | All 5 spec commits use Conventional Commits (`feat(...)`, `chore(...)`) and include `Related to T#.# in Spec 03-spec-espn-backend` in the body |
| No new runtime deps | Verified | `git diff 693f2df^..HEAD -- package.json` shows no dependency additions; HTTP via `fetch`, scripts via existing `tsx` devDep |
| Mobile-first / `min-h-dvh` / 44×44 touch targets | N/A | No UI surfaces added or changed by this spec |
| Env validation via `lib/env.ts` | N/A | No new env vars introduced (ESPN public endpoints are unauthenticated) |

### Proof Artifacts

| Unit/Task | Proof Artifact | Status | Verification Result |
| --- | --- | --- | --- |
| T1.0 | [03-task-01-proofs.md](docs/specs/03-spec-espn-backend/03-proofs/03-task-01-proofs.md) | Verified | File exists; `pnpm test:ci lib/espn/client.test.ts` re-run = 22/22 pass |
| T2.0 | [03-task-02-proofs.md](docs/specs/03-spec-espn-backend/03-proofs/03-task-02-proofs.md) | Verified | File exists; aggregator + cache + leagues + events-catalog tests all green |
| T3.0 | [03-task-03-proofs.md](docs/specs/03-spec-espn-backend/03-proofs/03-task-03-proofs.md) | Verified | File exists; catalog facts confirmed by independent `node -e` check (1,675 teams, 19 leagues, 3 sports) |
| T3.0 | [03-catalog-counts.md](docs/specs/03-spec-espn-backend/03-proofs/03-catalog-counts.md) | Verified | Per-league counts match live `jq` output |
| T4.0 | [03-task-04-proofs.md](docs/specs/03-spec-espn-backend/03-proofs/03-task-04-proofs.md) | Verified | File exists; migration `0003_reset_favorites_for_espn.sql` present and journal-wired |
| T5.0 | [03-task-05-proofs.md](docs/specs/03-spec-espn-backend/03-proofs/03-task-05-proofs.md) | Verified | File exists; cold-cache 291ms, p50 83ms, breadth 8/8, residue 0 |
| T5 | [05-ci-gates.txt](docs/specs/03-spec-espn-backend/03-proofs/05-ci-gates.txt) | Verified | Re-running the same gate suite produces the same green result |
| T5 | [05-grep-residue.txt](docs/specs/03-spec-espn-backend/03-proofs/05-grep-residue.txt) | Verified | Re-running the grep returns zero hits |
| T5 | [05-breadth.txt](docs/specs/03-spec-espn-backend/03-proofs/05-breadth.txt) | Verified | All 8 anchors reproduce ≥ 1 hit against the committed catalog |
| T5 | [05-cold-cache.txt](docs/specs/03-spec-espn-backend/03-proofs/05-cold-cache.txt) | Verified | File exists with 291ms cold measurement; Audit FLAG §1 empirically resolved |
| T5 | [05-soccer-fanout.txt](docs/specs/03-spec-espn-backend/03-proofs/05-soccer-fanout.txt) | Verified | File exists with p50 = 83ms; Audit FLAG §2 empirically resolved |
| T5 | [03-proofs/README.md](docs/specs/03-spec-espn-backend/03-proofs/README.md) | Verified | Manifest indexes every artifact with FR / Success-Metric mapping |
| T5.3 | `05-homepage.png` | Deferred | Requires user's signed-in browser session; reproduction recipe documented in T5 proof |
| T5.4 | `05-live-update.png` | Deferred | Requires live in-progress game during validation window; recipe documented |

## 3) Validation Issues

### MEDIUM

1. **Stale "Relevant Files" planning note vs actual changes**
   - Issue: The `## Relevant Files` table in the task list still lists `lib/favorites/validators.ts` as needing modification, but the only change to that file across the spec was a `Sport` import-path bump (in `693f2df`); no behavioral change landed. Conversely, `lib/favorite-matcher.ts` had a non-trivial cleanup (removal of `KNOWN_CONTAINER_LEAGUE_NAME_CONTAINS`) in `9ed559e` that exceeds what the "Relevant Files" entry described as "MODIFY (minimal)".
   - Impact: Traceability only — every change is captured in a per-task proof file and its commit body. No requirement coverage gap.
   - Recommendation: Optional — update the Relevant Files table post-merge to reflect actual changes, or leave it as planning-era guidance with a footnote pointing to the proofs. Not a merge blocker.

2. **Two visual proof artifacts deferred to user**
   - Issue: `05-homepage.png` (T5.3) and `05-live-update.png` (T5.4) are not present in the bundle; the agent cannot drive the user's signed-in browser session.
   - Impact: Success Metric §3 (live-score freshness ≤ 30s) cannot be empirically verified by the agent. It is provably *configured* (30s TTL test in `cache.test.ts`) but not *observed* end-to-end.
   - Recommendation: User runs the documented recipes in [03-task-05-proofs.md](docs/specs/03-spec-espn-backend/03-proofs/03-task-05-proofs.md#deferred-to-user-verification) and drops the resulting PNGs into `docs/specs/03-spec-espn-backend/03-proofs/` before merge. Acceptable as a follow-up if a live game isn't available now.

3. **No screenshot of the favorites typeahead in the bundle**
   - Issue: The spec's Unit 3 proof artifact list mentions "Screenshot: Favorites typeahead in the dev server showing ESPN-sourced team and league results for at least one query per sport." The behavior is fully test-covered (20 tests, 8/8 anchor queries), but no PNG was captured.
   - Impact: Lower — `route.test.ts` proves the same property programmatically. The screenshot would be belt-and-suspenders.
   - Recommendation: Optional — capture during the same user-verification step as T5.3/T5.4.

### LOW

4. **Secret-scan false positives in CI transcript**
   - Issue: `05-ci-gates.txt` contains 11 occurrences of the substring "secrets" from dotenv's startup banner tip (`◇ injected env (...) // tip: ◈ secrets for agents [...]`). No actual credentials.
   - Impact: None — these are advertising chatter from `dotenv`'s loader, not real secret values. Verified that the transcript contains no `DATABASE_URL=...`, `AUTH_SECRET=...`, or other credential-bearing lines.
   - Recommendation: None required. Worth knowing if running an automated secret scanner on the proof bundle — these will trip word-based matchers.

No CRITICAL or HIGH issues. **No remediation blockers.**

## 4) Evidence Appendix

### Commits analyzed

| SHA | Title | Files changed | Insertions / Deletions |
| --- | --- | --- | --- |
| `693f2df` | feat(espn): add ESPN client alongside TheSportsDB; move types to provider-neutral path | 22 | +1620 / −9 |
| `9bb0f45` | feat(espn): fan out aggregator by league key and remap events catalog | 12 | +742 / −600 |
| `9ed559e` | feat(search): snapshot ESPN catalog + remove TheSportsDB and Tennis | 30 | +12,597 / −1,082 |
| `162f61f` | feat(db): reset favorites for ESPN cutover + release note | 6 | +551 / −8 |
| `1ed83a5` | chore(verify): final verification bundle for Spec 03 ESPN backend swap | 8 | +523 / −9 |

Every commit body contains `Related to T#.# in Spec 03-spec-espn-backend`. Git traceability score: **OK**.

The bulk of `9ed559e`'s `+12,597` insertions are the committed `lib/espn/catalog.json` (1,675 teams) and its accompanying test/route/cleanup changes — verified by `git show --stat 9ed559e`.

### Independent re-runs (this validation pass)

```text
$ grep -rE "thesportsdb|lib/sportsdb" --include="*.ts" --include="*.tsx" --include="*.json" . \
    | grep -v node_modules | grep -v .next | grep -v docs/specs | grep -v pnpm-lock.yaml
(zero hits)

$ pnpm test:ci
 Test Files  29 passed (29)
      Tests  241 passed (241)

$ pnpm typecheck
$ tsc --noEmit
(clean)

$ pnpm lint
$ eslint
(clean)

$ pnpm format:check
$ prettier --check .
All matched files use Prettier code style!

$ node -e "const c=require('./lib/espn/catalog.json'); console.log(c.teams.length, c.leagues.length, [...new Set(c.teams.map(t=>t.sport))]);"
1675 19 [ 'American Football', 'Basketball', 'Soccer' ]

$ ls db/migrations/ | grep ^00
0000_new_nemesis.sql
0001_charming_echo.sql
0002_freezing_norrin_radd.sql
0003_reset_favorites_for_espn.sql
```

### File classification (GATE D)

| Class | Count | Mapping outcome |
| --- | --- | --- |
| Core implementation files added/modified | 14 | All map to a Unit FR via the Relevant Files table or commit body. No unmapped out-of-scope core changes. **GATE D1: PASS.** |
| Supporting files added (tests, fixtures, catalog JSON, scripts, proofs, README) | 16 | All have linkage either in Relevant Files or in a per-task proof. **GATE D2: PASS.** |

### Security check (GATE F)

No real credentials in any proof artifact. The 11 false-positive matches for "secrets" are dotenv startup-banner advertising text; no credential values. The catalog JSON contains only public team metadata. **GATE F: PASS.**

---

**Validation Completed:** 2026-06-24
**Validation Performed By:** Claude Opus 4.7
