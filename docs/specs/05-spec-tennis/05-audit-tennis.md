# 05-audit-tennis.md

## Executive Summary

- Overall Status: **PASS**
- Required Gate Failures: **0**
- Flagged Risks: **2**

## Gateboard

| Gate | Status | Why it failed (≤10 words) | Exact fix target |
| --- | --- | --- | --- |
| Requirement-to-test traceability | PASS | — | — |
| Proof artifact verifiability | PASS | — | — |
| Repository standards consistency | PASS | — | — |
| Open question resolution | PASS | — | — |
| Regression-risk blind spots | FLAG | Mid-Slam screenshot may need fixture mode | T3.10 |
| Non-goal leakage | FLAG | T3.7 / T3.8 edit `components/home-client.*` — confirm in §6 envelope | Spec §Success Metric 6 |

## Standards Evidence Table

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | Next 16 App Router; TS strict; Tailwind v4 mobile-first; Drizzle ORM; Vitest colocated; Conventional Commits w/ `Related to T#.# in Spec NN-...` body; CI gates = lint → format:check → typecheck → test:ci → build | none |
| `CLAUDE.md` | yes | Re-exports `AGENTS.md` verbatim (`@AGENTS.md`) | none |
| `README.md` | yes | Operations → Release notes is the deploy log; cache-prefix bumps drive invalidation; Vercel is the deploy target | none |
| `package.json` (scripts) | yes | `lint`, `format`, `format:check`, `typecheck`, `test`, `test:ci`, `build`, `db:migrate` are the gate commands | none |
| `.github/workflows/ci.yml` | yes (confirmed exists) | CI runs the same gate suite on every PR | none |

## Requirement-to-test traceability map

| Spec FR | Mapped task(s) | Planned test artifact |
| --- | --- | --- |
| Unit 1: `"Tennis"` in `Sport` union + `SUPPORTED_SPORTS` | T1.1 | `pnpm typecheck` clean (R3 of T1.0) + downstream `lib/favorites/validators.test.ts` accept (T1.7) |
| Unit 1: `tennis: "Tennis"` segment mapping | T1.2, T1.3 | `lib/espn/client.test.ts` table cases (T1.3) |
| Unit 1: `MARQUEE_TENNIS_TOURNAMENTS` registry (23 entries) | T1.4 | `lib/espn/tennis.test.ts` length + id-regex + Slam presence (T1.6) |
| Unit 1: `tennisScoreboard(id, date)` client | T1.5 | `lib/espn/tennis.test.ts` parse happy path + empty path (T1.6) |
| Unit 1: Validator accepts `Tennis` `event` | T1.7 | `lib/favorites/validators.test.ts` positive case (T1.7) |
| Unit 1: Tennis NOT in `SPORT_ALLOWLIST` | T1.8 | `lib/sport-allowlist.test.ts` absence assertion (T1.8) |
| Unit 1: Endpoint verification proof | T1.9, T1.10 | `05-proofs/05-endpoint-verify.txt` capture (T1.9, T1.10) |
| Unit 2: `getActiveTennisTournaments` | T2.1, T2.2 | `lib/home/tennis-aggregator.test.ts` count/filter/round (T2.3) |
| Unit 2: 1h cache layer | T2.5 | `lib/home/cache.test.ts` key-shape assertion (T2.9) |
| Unit 2: `CACHE_KEY_PREFIX = "v7-espn-tennis"` | T2.4 | `lib/home/cache.test.ts` prefix assertion (T2.9) |
| Unit 2: Aggregator `activeTennisTournaments` field | T2.6, T2.7, T2.8 | `lib/home/aggregator.test.ts` envelope + failure paths (T2.10) |
| Unit 2: `TournamentCard` collapsed render | T3.3 | `components/tournament-card.test.tsx` collapsed-state assertions (T3.5) |
| Unit 2: Mixed-feed sort key | T3.6, T3.7 | `lib/home/aggregator.test.ts` sort test (T2.10/T3.6) + `components/home-client.test.tsx` slot test (T3.8) |
| Unit 3: Expand-on-tap | T3.4 | `components/tournament-card.test.tsx` toggle + independent expand (T3.5) |
| Unit 3: `MatchCard` player-vs-player | T3.1 | `components/match-card.test.tsx` player fixture (T3.2) |
| Unit 3: Year-less catalog entries | T4.1 | `lib/espn/catalog.test.ts` Wimbledon assertion + count bump (T4.2) |
| Unit 3: Search route translates to `type: "event"` | T4.3 | `app/api/favorites/search/route.test.ts` translation case (T4.4) |
| Unit 3: README release note | T5.1 | Diff inspection captured in `05-touched-files.txt` (T5.3) |
| Success Metric §6 (no out-of-scope edits) | T5.3 | `05-touched-files.txt` vs allowed-set check (T5.3) |
| Success Metrics §1–§5 | T5.2, T5.5 | `05-ci-gates.txt` (T5.2) + per-task proof markdowns (T5.5) |

Every FR has at least one planned test artifact.

## Findings

### REQUIRED Failures

None.

### FLAG Findings

1. **Mid-Slam screenshot reproducibility (T3.10).**
   - Risk: The proof artifact for the collapsed and expanded tournament card depends on a marquee tournament being active on the day of capture. The 23 tournaments are in session for roughly 50 weeks of the year combined, but there will be ~2 weeks when no marquee is active and the screenshot cannot be captured from a live homepage.
   - Suggested remediation: T3.10 already permits a fixture-driven devtools screenshot as an acceptable substitute; T3.5 already mandates a fixture test that renders the same UI. Keep the fallback path explicit in T3.10's wording and accept either source for the proof bundle.

2. **`components/home-client.*` edits vs Success Metric §6.**
   - Risk: §6 lists `components/match-card*` and `components/tournament-card*` as in-scope but does not explicitly mention `home-client`. T3.7 / T3.8 modify `components/home-client.tsx` and its test to wire the new envelope field into the mixed feed. This is plainly necessary for the spec to function (without it, tournament cards never render), but the §6 wording is narrow enough that a literal reading could be tripped up.
   - Suggested remediation: Either (a) clarify §6 to include `components/home-client.*` as in-scope at remediation time, or (b) leave as-is and rely on the existing parenthetical "to read `activeTennisTournaments` from the aggregator output" as covering the home-client wiring. Recommend (a) for clarity. Will apply only with user approval.

## User-Approved Remediation Plan

Pending approval.

If approved, the only edit will be to **Spec §Success Metric 6**: add `components/home-client.*` to the explicit in-scope list, mirroring the existing language about reading the envelope field. No task-list change is needed for FLAG 1 (T3.10 already covers it).

## Re-Audit Delta

### Run 2 — after approved remediation

- **FLAG: Non-goal leakage** → **CLEARED.** Spec §Success Metric 6 updated to include `components/home-client*` and the favorites search route handler/test in the in-scope file set, matching the actual edits T3.7/T3.8/T4.3/T4.4 perform.
- **FLAG: T3.10 screenshot reproducibility** → unchanged (no edit required; fixture fallback already permitted).
- **All REQUIRED gates: still PASS.**
- Status: **PASS, cleared for `/SDD-3-manage-tasks`.**
