# Spec 03 — ESPN backend swap, proof artifact manifest

This directory bundles the evidence for [03-spec-espn-backend.md](../03-spec-espn-backend.md). Each per-task proof file leads with what the task proved; this manifest indexes those artifacts and maps each to the spec FR or success metric it evidences.

## Per-task proof files

| File | Maps to |
| --- | --- |
| [03-task-01-proofs.md](./03-task-01-proofs.md) | Spec Unit 1 — provider-neutral types + ESPN client module |
| [03-task-02-proofs.md](./03-task-02-proofs.md) | Spec Unit 2 — league fan-out + events catalog remap (+ tiered cache TTLs absorbed from Unit 4) |
| [03-task-03-proofs.md](./03-task-03-proofs.md) | Spec Unit 3 — snapshot catalog + new search route (+ final TheSportsDB + Tennis cleanup from T1.3 / T1.11 / T1.12) |
| [03-task-04-proofs.md](./03-task-04-proofs.md) | Spec Unit 4 — favorites-reset migration + README release note |
| [03-task-05-proofs.md](./03-task-05-proofs.md) | This task — end-to-end verification + cold-cache + fan-out + residue sweep |
| [03-catalog-counts.md](./03-catalog-counts.md) | Per-league team counts for the committed `lib/espn/catalog.json` |

## Raw evidence files (Task 5)

| File | What it proves | Maps to |
| --- | --- | --- |
| [05-ci-gates.txt](./05-ci-gates.txt) | All five CI gates (`lint`, `format:check`, `typecheck`, `test:ci`, `build`) pass | Spec Success Metric §5 |
| [05-grep-residue.txt](./05-grep-residue.txt) | Zero `thesportsdb` / `lib/sportsdb` references in code | Spec Success Metric §1 |
| [05-breadth.txt](./05-breadth.txt) | 8/8 anchor queries return ≥ 1 result | Spec Success Metric §4 |
| [05-cold-cache.txt](./05-cold-cache.txt) | Cold-fan-out latency = 291ms across 70 ESPN scoreboard calls | Audit FLAG §1 |
| [05-soccer-fanout.txt](./05-soccer-fanout.txt) | p50 latency = 83ms across 5 runs of the 14-league soccer fan-out | Audit FLAG §2 |

## Coverage matrix — FRs and Success Metrics → evidence

| Spec item | Evidence |
| --- | --- |
| Unit 1 FR — ESPN client public surface | [03-task-01](./03-task-01-proofs.md): `lib/espn/client.test.ts`, 22 tests |
| Unit 1 FR — `pre`/`in`/`post` → `upcoming`/`live`/`final` | [03-task-01](./03-task-01-proofs.md): status-mapping tests |
| Unit 1 FR — kickoff timestamp parsed directly | [03-task-01](./03-task-01-proofs.md): EPL fixture test asserts `kickoffUtc === "2026-03-08T16:30Z"` |
| Unit 1 FR — `events: null` returns `[]` | [03-task-01](./03-task-01-proofs.md): empty-scoreboard fixture test |
| Unit 1 FR — site v2 hot path; core API only as fallback | [03-task-01](./03-task-01-proofs.md): `fetchEventCoreDetail` opt-in helper + URL whitelist test |
| Unit 1 FR — remove `lib/sportsdb/` | [05-grep-residue.txt](./05-grep-residue.txt): zero hits |
| Unit 2 FR — `SUPPORTED_LEAGUES` covers v1 set | [03-task-02](./03-task-02-proofs.md): `lib/espn/leagues.test.ts` asserts 2 + 3 + 14 |
| Unit 2 FR — per-(leagueKey, date) fan-out | [03-task-02](./03-task-02-proofs.md): aggregator test asserts 15 calls per Basketball Team favorite |
| Unit 2 FR — events catalog uses ESPN keys | [03-task-02](./03-task-02-proofs.md): events-catalog tests |
| Unit 2 FR — bucketing, dedup, partial failure preserved | [03-task-02](./03-task-02-proofs.md): aggregator test suite |
| Unit 3 FR — operator-run refresh script | [03-task-03](./03-task-03-proofs.md): dry-run + real-run captures |
| Unit 3 FR — committed catalog with ≥ 500 teams | [03-catalog-counts.md](./03-catalog-counts.md): 1,675 teams |
| Unit 3 FR — search route uses in-memory catalog | [03-task-03](./03-task-03-proofs.md): `route.test.ts` + `catalog.test.ts` |
| Unit 3 FR — per-category cap + ordering preserved | [03-task-03](./03-task-03-proofs.md): cap and ordering tests |
| Unit 4 FR — tiered TTLs (30/3600/300) | [03-task-02](./03-task-02-proofs.md): `cache.test.ts` |
| Unit 4 FR — cache key prefix `v3-espn` | [03-task-02](./03-task-02-proofs.md): cache test asserts prefix |
| Unit 4 FR — TRUNCATE migration | [03-task-04](./03-task-04-proofs.md): migration SQL + post-apply row count |
| Unit 4 FR — README release note | [03-task-04](./03-task-04-proofs.md): diff |
| Success Metric §1 — zero TheSportsDB residue | [05-grep-residue.txt](./05-grep-residue.txt) |
| Success Metric §2 — pre-existing tests still pass | [05-ci-gates.txt](./05-ci-gates.txt): 241/241 |
| Success Metric §3 — live-score freshness ≤ 30s | **Deferred to user verification** (see Task 5 proofs) |
| Success Metric §4 — breadth: 8/8 anchor queries | [05-breadth.txt](./05-breadth.txt) |
| Success Metric §5 — CI green | [05-ci-gates.txt](./05-ci-gates.txt): all five gates pass |
| Audit FLAG §1 — cold-cache observation | [05-cold-cache.txt](./05-cold-cache.txt): 291ms cold |
| Audit FLAG §2 — soccer fan-out p50 | [05-soccer-fanout.txt](./05-soccer-fanout.txt): p50 = 83ms (well under 5s threshold) |

## Notes on deferred-to-user verification

- **Homepage screenshot** (Success Metric § implicit, T5.3) and **live in-progress game observation** (Success Metric §3, T5.4) require a signed-in browser session against a real user account and (for T5.4) an actually-live game during the validation window. These cannot be captured by the agent without driving the user's browser; they are documented in [03-task-05-proofs.md](./03-task-05-proofs.md) with an exact reproduction script the user can run.
