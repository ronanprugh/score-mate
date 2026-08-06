# 13-validation-teams-match-coverage-and-cards.md

Validation of the implementation on `feat/13-teams-match-coverage` against
[`13-spec-teams-match-coverage-and-cards.md`](13-spec-teams-match-coverage-and-cards.md)
and [`13-tasks-teams-match-coverage-and-cards.md`](13-tasks-teams-match-coverage-and-cards.md).

## 1) Executive Summary

- **Overall: PASS** — no gate tripped. GATE E is qualified (see below).
- **Implementation Ready: Yes.** All 20 functional requirements are verified
  against source or executing tests, all five proof artifact files are present
  and reviewable, and every commit maps to a parent task.
- **Key metrics:**
  - Requirements verified: **20 / 20 (100%)**, zero `Unknown`
  - Proof artifacts working: **5 / 5 files**, 17 / 17 named test cases exist and pass
  - Files changed: **38** — 31 mapped to "Relevant Files", 7 mapped to
    implementation-time sub-tasks, **0 unmapped core changes**
  - Test suite: **507 / 507 passing** across 48 files
  - Commits: 5, each referencing `Spec 13-spec-teams-match-coverage-and-cards`

| Gate | Result |
| --- | --- |
| A — no CRITICAL/HIGH issues | **PASS** (0 CRITICAL, 0 HIGH) |
| B — no `Unknown` in coverage matrix | **PASS** (20/20 Verified) |
| C — proof artifacts accessible | **PASS** |
| D1 — no unmapped out-of-scope core changes | **PASS** |
| D2/D3 — supporting-file linkage | **PASS** (two gaps found and closed during validation) |
| E — repository standards | **PASS, qualified** — `pnpm lint` fails on a pre-existing error, byte-identical on `main` |
| F — no secrets in proof artifacts | **PASS** |

**One caveat carried forward, by design rather than omission:** Spec 13's cold
latency budget is measured at the upstream layer but **not verified end to end**.
Spec 12's figures came from an instrumented production deployment with a
signed-in session, which this environment cannot reproduce. Task 5.0 records the
status as "likely pass, unconfirmed" rather than claiming a pass. That is the
correct disposition, and it is not a validation failure — but a reviewer should
know the budget line is an estimate until one post-deploy measurement is run.

## 2) Coverage Matrix

### Functional Requirements

| # | Requirement (abbreviated) | Status | Evidence |
| --- | --- | --- | --- |
| FR-1 | Explicit season parameter on schedule requests | Verified | `buildTeamScheduleUrl` season branch, `lib/espn/client.ts`; test `team schedule URL appends the season when one is given` |
| FR-2 | Retry previous season when current returns zero events | Verified | Test `falls back to the previous season when the current season is empty`; mutation removing the retry fails 4 tests (`13-task-01-proofs.md`) |
| FR-3 | At most one fallback retry per (league, team) | Verified | Test `issues exactly two requests when falling back`; request-count assertion |
| FR-4 | Implemented inside `teamScheduleForLeague` so both routes inherit | Verified | Both routes call the shared `teamScheduleAcrossCompetitions` → `teamScheduleForLeague`: `app/api/teams/route.ts:113`, `app/api/teams/[favoriteId]/matches/route.ts:84` |
| FR-5 | Return `[]`, not throw, when both seasons empty | Verified | Test `resolves to an empty array (does not throw) when both seasons are empty`; companion test confirms HTTP failures still throw |
| FR-6 | Cache seasons independently, season in the key | Verified | `scheduleCacheKey` in `lib/teams/cached-schedule.ts`; test `produces distinct keys for two seasons` |
| FR-7 | Curated companion-league map keyed by primary league | Verified | `COMPANION_LEAGUE_KEYS`, `lib/espn/leagues.ts`; test asserts the six expected keys for `soccer/eng.1` |
| FR-8 | Register `club.friendly` **without** entering `leagueKeysForSport` | Verified | `COMPANION_ONLY_LEAGUES`; source inspection confirms `club.friendly` absent from the `SUPPORTED_LEAGUES` block; test `keeps club.friendly out of the Home aggregator's fan-out` |
| FR-9 | Empty companion list for single-competition sports | Verified | Test `returns no companions for single-competition sports` (NFL/NBA/MLB → `[]`) |
| FR-10 | Concurrent requests, independent per-league caching | Verified | Test `issues every league request concurrently` asserts max-in-flight = 7; `cachedTeamScheduleForLeague` keys per league |
| FR-11 | Merge and dedupe by match id | Verified | Test `dedupes a fixture that appears under more than one league key` |
| FR-12 | Tolerate partial failure; record in `source.errors` | Verified | Tests `records an error but keeps the other competitions when one league fails` and the two route-level partial-failure cases |
| FR-13 | Chronological selection, no preference for competitive fixtures | Verified | Test `selects a friendly over an older league fixture — no preference for competitive matches` |
| FR-14 | Header + stacked last/next cards per entity | Verified | `components/entity-card.tsx`; test `renders a Home-style match card for each populated side`; screenshot `teams-list-375.png` |
| FR-15 | Reuse `MatchCard` / `TennisMatchCard` per sport | Verified | Shared `EntityMatchCard` imported by `entity-card.tsx:4` and `entity-matches-client.tsx:8`; tests for both branches |
| FR-16 | Single column at all viewport widths | Verified | `grep grid-cols components/teams-client.tsx` → none; test `lays entities out in a single column at every breakpoint`; screenshot `teams-list-1280.png` |
| FR-17 | Surface competition name on each card | Verified | `competition = round ?? leagueName`, `components/match-card.tsx`; tests for both fallback and precedence; `CLUB FRIENDLY` visible in screenshot |
| FR-18 | Preserve empty states (per-side and both-null) | Verified | Tests `shows 'Match data unavailable' when both matches are null`, `shows per-side empty copy when only one side is missing`; both visible in screenshot |
| FR-19 | Header links to `/teams/[favoriteId]` | Verified | `components/entity-card.tsx:65`; test `renders as a link to the entity's detail route with an accessible label` |
| FR-20 | Header tap target ≥ 44×44 px | Verified | `min-h-11` at `components/entity-card.tsx:67`; test `keeps the header tap target at the 44px minimum` |

### Repository Standards

| Standard Area | Status | Evidence & Compliance Notes |
| --- | --- | --- |
| Coding standards (TS `strict`, no `any`) | Verified | `pnpm typecheck` clean; no `any`, no `@ts-ignore` added |
| Tailwind mobile-first, `min-h-11` targets | Verified | Default classes target small screens; `min-h-11` on the entity header |
| Testing patterns (colocated, hermetic) | Verified | New tests colocated; ESPN calls injected via `ClientOptions.fetchFn` and the existing `routedFetch` router — no global `fetch` patching, no network in CI |
| Quality gates | **Qualified** | `format:check` ✅, `typecheck` ✅, `test:ci` ✅ 507/507, `build` ✅. `pnpm lint` ❌ on a pre-existing error — see MEDIUM-1 |
| Commit conventions | Verified | 5 Conventional Commits, each with `Related to T[n].0 in Spec 13-...` in the body |
| Documentation patterns | Verified | README "Operations → Release notes" entry follows the Spec 03/04/05 format, and explains why no cache-prefix bump is needed |
| Next.js 16 conventions | Verified | `unstable_cache` retained per Spec 12's evaluation and Spec 13 Non-Goal #4; deviation documented in `lib/teams/cached-schedule.ts` |

### Proof Artifacts

| Unit/Task | Proof Artifact | Status | Verification Result |
| --- | --- | --- | --- |
| 1.0 | `13-task-01-proofs.md` (201 lines) | Verified | File present; 5 named test cases exist and pass; live `curl` evidence reproducible |
| 1.0 | Mutation check (2 mutations) | Verified | Documented failures 1 and 4; restored run green |
| 2.0 | `13-task-02-proofs.md` (256 lines) | Verified | 7 named test cases exist and pass; `COMPANION_LEAGUE_KEYS` diff matches source |
| 2.0 | Mutation check on retargeted route mocks | Verified | 7/23 fail under mutation — mocks proven wired to the live path |
| 3.0 | `13-task-03-proofs.md` (210 lines) | Verified | Dead-code claim re-verified with a sound command during validation — see MEDIUM-2 |
| 4.0 | `13-task-04-proofs.md` + 2 screenshots | Verified | Both images exist (117 KB / 55 KB), embedded inline with `![...]`, paths resolve |
| 5.0 | `13-task-05-proofs.md` (193 lines) | Verified | `scripts/measure-teams-fanout.ts` executes and reproduces the reported figures |

## 3) Validation Issues

No CRITICAL or HIGH issues. Three MEDIUM, two already resolved during this
validation pass.

| Severity | Issue | Impact | Recommendation |
| --- | --- | --- | --- |
| MEDIUM-1 | **Pre-existing lint error blocks CI.** `components/home-client.tsx:401` uses `<a>` to navigate to `/teams/` where `next/link` is required. Evidence: `pnpm lint` output is byte-identical on `main` and on this branch (1 error, 2 warnings). | CI red independently of this spec; `pnpm lint` cannot gate this branch cleanly | Not caused by, and out of scope for, Spec 13 — deliberately left unfixed to keep commits scoped. Fix separately; a background task is already queued for it. |
| MEDIUM-2 | **Unsound verification command in a proof artifact (resolved).** `13-task-03-proofs.md` verified `athleteSchedule` removal with `grep ... \| grep -v athleteMatchHistory`, which discards any line mentioning both names — a surviving call site adjacent to an `athleteMatchHistory` reference would have been filtered out and reported as "gone". | Traceability: the conclusion was correct but the evidence did not establish it | **Resolved.** Re-verified with `grep -rnE "export (async )?function athleteSchedule\|athleteSchedule\("` → no declaration, no call sites. Proof file corrected with a note; a now-stale comment naming `athleteSchedule` was removed from `app/api/teams/route.ts`. |
| MEDIUM-3 | **Supporting/core files missing from "Relevant Files" (resolved).** `components/entity-match-card.tsx` (new core), `lib/teams/cached-schedule.ts`, `app/dev-fixture/nav/page.tsx`, `scripts/measure-teams-fanout.ts`, `components/entity-matches-client.tsx`, and `.claude/launch.json` were changed without appearing in the planning-era table, though five of six had sub-task linkage. | Traceability gap; requirement verification unaffected | **Resolved.** All six added to the "Relevant Files" table with their originating sub-task noted. |

### Notes on gates not tripped

- **GATE D1:** every core change maps to a requirement or sub-task. The only
  non-runtime change is `.claude/launch.json` (`autoPort`, tooling), now
  documented.
- **GATE F:** scanned all spec artifacts for credential-shaped strings, emails,
  and internal hostnames. The only matches are prose in the spec's own Security
  Considerations. The recorded ESPN fixtures were deliberately stripped of `$ref`
  URLs carrying an internal `espn.pvt` hostname during Task 1.0; re-verified
  absent. Screenshots come from the dev-fixture route, which renders no account
  menu, so no user email is exposed.

## 4) Evidence Appendix

### Commits analyzed

```text
389ef91 docs(teams): record match-coverage performance evidence and release note
f4c1c31 feat(teams): render Teams list entities as Home-style match cards
0a2a25d refactor(teams): return full Match objects from /api/teams
374194f feat(teams): include cup, continental, and friendly fixtures in team schedules
c2399f6 fix(teams): resolve ESPN season explicitly with previous-season fallback
63a6033 docs(teams): add spec 13 planning artifacts   (baseline)
```

All five implementation commits reference the spec in the body (`refs=1` each).
The progression is coherent: data fix → coverage → contract → UI → evidence.

### Named test cases verified to exist

17 of 17 test names quoted across the proof artifacts were located in the test
sources and pass. No proof artifact cites a test that does not exist.

### Gate commands executed

```text
$ pnpm typecheck        → clean
$ pnpm format:check     → All matched files use Prettier code style!
$ pnpm test:ci          → Test Files 48 passed (48) | Tests 507 passed (507)
$ pnpm build            → succeeded (Task 5.0)
$ pnpm lint             → 3 problems (1 error, 2 warnings) — identical on main
```

### Scope-creep check

Three changes went beyond the written spec. All are documented in the task file
and none is unmapped:

1. **`parseScore` object-shape fix** (sub-task 1.9) — not in the spec. Found
   while recording fixtures: the team-schedule endpoint returns
   `score: { value, displayValue }` where the scoreboard returns `"2"`, so every
   completed match from a team schedule silently lost its score. Justified: it
   would have shipped the redesigned score cards with no scores in them.
2. **`EntityCard` rewrite moved from Task 4.0 to Task 3.0** (sub-task 3.8) —
   forced, not elective: changing `TeamEntity` to `Match` breaks the component's
   compile, so `pnpm typecheck` could not pass otherwise.
3. **`EntityCard` outer border/padding removed** (sub-task 4.11) — a design
   change made after observing name truncation at 375px in the live render.

### Spec deviations accepted

- **Non-Goal #1 amended** during planning remediation to cover presentation
  only, so the detail screen could share the data layer. Recorded in the spec.
- **Cold budget relaxed** from Spec 12's 600 ms to 1 200 ms as the documented
  cost of competition coverage. Recorded in the spec's Technical Considerations
  and flagged as Open Question 3.

---

**Validation Completed:** 2026-08-05
**Validation Performed By:** Claude Opus 5
