# 13-audit-teams-match-coverage-and-cards.md

Planning audit for [`13-tasks-teams-match-coverage-and-cards.md`](13-tasks-teams-match-coverage-and-cards.md)
against [`13-spec-teams-match-coverage-and-cards.md`](13-spec-teams-match-coverage-and-cards.md).

## Executive Summary

- Overall Status: **PASS**
- Required Gate Failures: 0
- Flagged Risks: 0
- Audit run: 2 (run 1 findings and the approved remediation are retained below
  for history)

All 20 functional requirements map to a named, observable test artifact.
45 sub-tasks across 5 parent tasks, 34 proof artifacts.

## Gateboard (run 2)

| Gate | Status | Why it failed (<=10 words) | Exact fix target |
| --- | --- | --- | --- |
| Requirement-to-test traceability | PASS | — | — |
| Proof artifact verifiability | PASS | — | — |
| Repository standards consistency | PASS | — | — |
| Open question resolution | PASS | — | — |
| Regression-risk blind spots | PASS | — | — |
| Non-goal leakage | PASS | — | — |

## Gateboard (run 1 — superseded)

| Gate | Status | Why it failed (<=10 words) | Exact fix target |
| --- | --- | --- | --- |
| Requirement-to-test traceability | FAIL | Caching, route-inheritance, breakpoint requirements lack test artifacts | `## Tasks > 1.0`, `2.0`, `4.0` |
| Proof artifact verifiability | PASS | — | — |
| Repository standards consistency | PASS | — | — |
| Open question resolution | PASS | — | — |
| Regression-risk blind spots | PASS | — | — |
| Non-goal leakage | FLAG | Home feed and detail route touched | `## Tasks > 2.1`, `2.8` |

## Standards Evidence Table (Required)

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | Next.js 16 App Router, read `node_modules/next/dist/docs/` first; TS `strict`, no `any`; Tailwind v4 mobile-first, `min-h-dvh`, ≥44px targets; colocated Vitest tests; Conventional Commits referencing SDD task + spec | none |
| `README.md` | yes | Defers to `AGENTS.md` as authoritative; canonical `pnpm` script names; "Operations → Release notes" is where spec-level behaviour changes are recorded | none |
| `.github/workflows/ci.yml` | yes | Gate order `lint` → `format:check` → `typecheck` → `test:ci` → `build`; Node 22 + pnpm 11; build env is placeholders only, so tests must be hermetic | none |
| `package.json` | yes | `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:ci` (`vitest run`) | none |
| `lib/espn/client.test.ts`, `lib/espn/__fixtures__/` | yes | ESPN tests inject via `ClientOptions.fetchFn` with a `routedFetch(routes)` URL-substring router against committed JSON fixtures; no global `fetch` patching, no network | none |
| `CONTRIBUTING.md` | not found | — | — |
| `.github/pull_request_template.md` | not found | — | — |

Six sources read (two required when available); `AGENTS.md` and root `README.md`
both reviewed. No conflicts, so no precedence decision is required. Standards
confidence: high.

## Findings

### REQUIRED Failures

1. **Season-scoped caching has no test artifact.**
   Spec Unit 1 FR6 requires current-season and fallback-season results to be
   cached independently "so a fallback result is not served after the new season
   publishes fixtures", and Spec Unit 2 FR4 requires per-league independent
   caching. Sub-task 2.7 implements the cache key, but no planned test asserts
   the key composition. This is the requirement most likely to be silently wrong
   — a cache key missing the season would make the Liverpool bug reappear as a
   *stale* screen weeks after the fix ships, which is harder to diagnose than the
   original empty screen.
   - Missing item: a test asserting the `unstable_cache` key array contains the
     league key **and** the resolved season, and that two seasons produce two
     distinct keys.
   - File section to edit: `## Tasks > 2.0 Proof Artifact(s)` and `#### 2.0 Tasks`.
   - Acceptance condition: a named test case exists in the 2.0 proof artifacts
     and a sub-task creates it; `pnpm test:ci` covers cache-key composition
     without invoking the real Next.js cache.

2. **Task 2.8 rewires the detail route but no sub-task maintains its tests.**
   `app/api/teams/[favoriteId]/matches/route.test.ts` exists and is thorough
   (12 cases: auth, 404, capping, catalog miss, fetch-throws, player paths,
   `Server-Timing`). All of them mock `@/lib/espn/client`'s
   `teamScheduleForLeague`. Task 2.8 switches the route to
   `teamScheduleAcrossCompetitions` in `lib/teams/schedule.ts`, so those mocks
   stop intercepting the real call path. Task 2.9 updates the mocks for
   `app/api/teams/route.test.ts` only — the detail route's suite is not
   mentioned anywhere in the task list, and neither is the file, in
   `## Relevant Files`. The suite would either break loudly or, worse, keep
   passing while testing a code path the route no longer takes.
   - Missing item: a sub-task updating the detail route's mocks to the new
     helper, plus a case proving multi-competition matches reach that route.
   - File section to edit: `#### 2.0 Tasks` (add after 2.8),
     `## Tasks > 2.0 Proof Artifact(s)`, and the `## Relevant Files` table.
   - Acceptance condition: `app/api/teams/[favoriteId]/matches/route.test.ts`
     is listed in Relevant Files, a sub-task retargets its mocks, and a proof
     artifact names a case asserting a friendly appears in that route's
     `recent` array.

3. **"Single column at all viewport widths" is proven at one width.**
   Spec Unit 3 FR3 requires the grid to collapse to a single column at *all*
   breakpoints — the point being that the `sm:`/`lg:` multi-column grid is
   removed, not merely unused on mobile. The only planned evidence is a 375px
   screenshot, which a two-column desktop layout would also pass.
   - Missing item: evidence at a wide viewport, plus a test that the multi-column
     classes are gone.
   - File section to edit: `## Tasks > 4.0 Proof Artifact(s)` and `#### 4.0 Tasks`.
   - Acceptance condition: a second screenshot at ≥1280px, and a
     `components/teams-client.test.tsx` case asserting the container carries no
     `sm:grid-cols-*` / `lg:grid-cols-*` class.

### FLAG Findings

1. **Adding `club.friendly` to `SUPPORTED_LEAGUES` changes the Home feed.**
   Spec Non-Goal #8 says Home is untouched. But `leagueKeysForSport("Soccer")`
   is what the home aggregator fans out over — verified at
   `lib/home/aggregator.ts:197`
   (`for (const key of leagueKeysForSport(sport)) keys.add(key)`) — so registering
   `soccer/club.friendly` adds a league × 5 dates to `/api/home` **and** makes
   friendlies appear in the Home feed for anyone following a soccer sport or
   league. That is a user-visible product change this spec never asked for, and
   it lands on the endpoint Spec 12 spent its whole scope optimizing.
   Sub-task 2.1 notices the fan-out cost but not the feed-content change.
   - Risk: unintended Home feed content change plus a ~5-call `/api/home`
     fan-out increase; directly contradicts Non-Goal #8.
   - Suggested remediation: keep `club.friendly` out of `SUPPORTED_LEAGUES` and
     instead register it in a separate `COMPANION_ONLY_LEAGUES` list that
     `findSupportedLeague` consults for display names but `leagueKeysForSport`
     does not return. Add a `lib/espn/leagues.test.ts` case asserting
     `leagueKeysForSport("Soccer")` does **not** include `club.friendly`.

2. **Task 2.8 extends data coverage to the entity detail screen.**
   Spec Non-Goal #1 excludes that screen. The task file argues the exclusion is
   about redesign rather than data, and that divergent coverage between the two
   Teams screens would be its own defect — a defensible reading, and it is
   documented inline rather than done silently.
   - Risk: scope grows beyond the written non-goal; the detail screen's
     10-per-side cap now draws from up to 7 competitions, which changes what
     that screen shows.
   - Suggested remediation: either accept and amend Spec Non-Goal #1 to say
     "redesign only", or drop 2.8 and accept that the two screens disagree.
     Recommend amending the spec — divergence would read as a new bug.

## User-Approved Remediation Plan

- **Approved (all five) — Completed**

| # | Remediation | Where applied |
| --- | --- | --- |
| 1 | `club.friendly` moved to a `COMPANION_ONLY_LEAGUES` list; `leagueKeysForSport` guard test added; `/api/home` measurement retained as counter-evidence | Spec Unit 2 FR2; tasks 2.1, 2.3, 5.4, 5.0 artifacts |
| 2 | Cache-key composition test added as artifact + sub-task | Task 2.0 artifacts, sub-task 2.12 |
| 3 | Detail-route mock retargeting + friendly-coverage case added; test file listed in Relevant Files | Sub-tasks 2.9, 2.10; Relevant Files |
| 4 | ≥1280px screenshot + no-multi-column-class test added | Task 4.0 artifacts, sub-tasks 4.7, 4.9 |
| 5 | Spec Non-Goal #1 amended to presentation-only | Spec Non-Goals |

## Re-Audit Delta (Run 2)

Changed gate statuses since run 1:

- Requirement-to-test traceability: **FAIL → PASS**. The three uncovered
  requirements (season-scoped cache key, detail-route inheritance, all-breakpoint
  single column) now each have a named test artifact and a sub-task that creates
  it. Verified: Spec Unit 1 FR6 → sub-task 2.12; Unit 1 FR4 → sub-tasks 2.9/2.10;
  Unit 3 FR3 → sub-tasks 4.7/4.9.
- Non-goal leakage: **FLAG → PASS**. Flag 1 is designed out rather than
  documented around — `leagueKeysForSport` never returns `club.friendly`, and
  that is enforced by a unit test *and* an `/api/home` latency measurement, so
  the Home feed cannot change silently. Flag 2 is resolved by amending Spec
  Non-Goal #1 to cover presentation only, making Task 2.8 in-bounds by the
  written spec rather than by an inline argument against it.

Still-failing REQUIRED gates: none.

Newly introduced findings: none. Sub-task renumbering in tasks 2.0 and 4.0 was
checked for orphaned cross-references; the spec's Technical Considerations
reference to `SUPPORTED_LEAGUES` was updated to match the companion-only split.

## Chain-of-Verification Notes

- Finding 2 in run 1 originally claimed the detail route had no test file. That
  was wrong — `app/api/teams/[favoriteId]/matches/route.test.ts` exists with 12
  cases. The claim came from a shell glob that failed silently on the bracketed
  directory name. The finding was corrected before presentation to the narrower,
  accurate problem (mocks pointing at an export the route no longer calls).
- Flag 1 was confirmed against source, not inferred: `lib/home/aggregator.ts:197`
  reads `for (const key of leagueKeysForSport(sport)) keys.add(key)`.
- Upstream ESPN behaviour underpinning Task 1.0 was verified by live request on
  2026-08-05, not assumed from documentation.
