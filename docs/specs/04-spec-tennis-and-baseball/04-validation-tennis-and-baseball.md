# 04-validation-tennis-and-baseball.md

Validation report for [04-spec-tennis-and-baseball](./04-spec-tennis-and-baseball.md), tracking [04-tasks-tennis-and-baseball](./04-tasks-tennis-and-baseball.md).

## 1) Executive Summary

- **Overall:** PASS
- **Implementation Ready:** **Yes** — all FRs are verified by proof artifacts and source inspection; every CI gate is green; Success Metric §6 forbidden-path check is clean.
- **Key metrics:** Requirements verified **11/11 (100%)**; proof artifacts working **6/6 (100%)**; files changed vs expected **all in scope** (no out-of-scope core file changes).

Gates evaluated:

| Gate | Result | Notes |
| --- | --- | --- |
| A — No CRITICAL/HIGH issues | PASS | None found. |
| B — No `Unknown` FR rows | PASS | All FRs verified. |
| C — Proof artifacts accessible | PASS | All six artifact files exist and are non-empty. |
| D — File integrity (tiered) | PASS | Every changed core file maps to an FR; supporting files (proofs, task list updates, README) are linked via commit messages and proof index. |
| E — Repository standards | PASS | Conventional Commits with `Related to T#.# in Spec 04-…` body; tests colocated; `pnpm lint/format:check/typecheck/test:ci/build` all green. |
| F — No real secrets in proofs | PASS | grep over proofs surfaces no API keys, tokens, or credentials. |

## 2) Coverage Matrix

### Functional Requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Unit 1 — FR-1: Extend `Sport` union + `SUPPORTED_SPORTS` to include `"Baseball"` | Verified | `lib/sports/types.ts:10` and `lib/sports/types.ts:16`; commit [6152be8](6152be8). |
| Unit 1 — FR-2: Add `baseball` → `"Baseball"` to `SPORT_FROM_SEGMENT` | Verified | `lib/espn/client.ts:46`; `lib/espn/client.test.ts` covers both `baseball/mlb` and `baseball/college-baseball`. |
| Unit 1 — FR-3: Add MLB + NCAA D-I to `SUPPORTED_LEAGUES` | Verified | `lib/espn/leagues.ts:93` (`baseball/mlb` → "MLB") and `lib/espn/leagues.ts:96` (`baseball/college-baseball` → "NCAA Baseball"). |
| Unit 1 — FR-4: Add Baseball block to `SPORT_ALLOWLIST` with MLB + CWS | Verified | `lib/sport-allowlist.ts:73`; includes `baseball/mlb`, `baseball/college-baseball`, and `leagueNameContains: "College World Series"`. |
| Unit 1 — FR-5: Favorites validator accepts Baseball | Verified | Validator is driven by `SUPPORTED_SPORTS`; `lib/favorites/validators.test.ts` moves Baseball into the accept set and keeps Tennis rejected. |
| Unit 1 — FR-6: Enumerated-sport fixtures include Baseball | Verified | `lib/sport-allowlist.test.ts` (allowlist coverage loop), `lib/favorites/validators.test.ts` (accept/reject sets) both updated. |
| Unit 2 — FR-1: Regenerate `lib/espn/catalog.json` | Verified | `jq '.teams | map(select(.sport == "Baseball")) | length'` → **467** (≥ 30 MLB + ≥ 250 NCAA per spec lower bound); MLB=30, NCAA D-I=437. |
| Unit 2 — FR-2: Bump `CACHE_KEY_PREFIX` to `v6-espn-baseball` | Verified | `lib/home/cache.ts:59`; doc comment updated at `lib/home/cache.ts:17-19`. |
| Unit 2 — FR-3: Test pins the new cache prefix | Verified | `lib/home/cache.test.ts:69-75` asserts `CACHE_KEY_PREFIX === "v6-espn-baseball"`. |
| Unit 2 — FR-4: README release note | Verified | `README.md` Operations → Release notes section now has a 2026-06-24 entry referencing Spec 04 and the cache-prefix invalidation. |
| Unit 2 — FR-5: Do NOT modify aggregator, home/favorites route handlers, or `components/**` | Verified | `git diff --name-only origin/main..HEAD | grep -E '…forbidden…'` returns nothing (exit 1). Touched-files proof captures the same result. |

### Repository Standards

| Standard Area | Status | Evidence |
| --- | --- | --- |
| Coding standards (Next 16, TS strict, Tailwind v4) | Verified | `pnpm typecheck` clean; no `any` or `@ts-ignore` introduced; UI untouched. |
| Testing patterns (Vitest colocated) | Verified | All updates colocated with their sources (`leagues.test.ts`, `client.test.ts`, `catalog.test.ts`, `cache.test.ts`, `sport-allowlist.test.ts`, `validators.test.ts`). |
| Quality gates (lint, format, typecheck, test, build) | Verified | `04-ci-gates.txt` captures all five gates exiting 0; 249/249 tests pass. |
| Commit conventions (Conventional Commits + spec reference) | Verified | Both commits use `feat(baseball): …` and a `Related to T#.0 in Spec 04-spec-tennis-and-baseball` body. |
| Documentation (Operations → Release notes) | Verified | README updated per spec. |

### Proof Artifacts

| Unit/Task | Proof Artifact | Status | Verification Result |
| --- | --- | --- | --- |
| T1.0 | [04-task-01-proofs.md](./04-proofs/04-task-01-proofs.md) | Verified | File exists; documents Unit 1 evidence with summary-first structure. |
| T2.0 | [04-task-02-proofs.md](./04-proofs/04-task-02-proofs.md) | Verified | File exists; descriptive title, per-artifact "What it proves / Why it matters" context, reviewer conclusion. |
| Catalog counts | [04-catalog-counts.md](./04-proofs/04-catalog-counts.md) | Verified | MLB=30, NCAA D-I=437, total 467 Baseball teams. Re-checked via `jq`. |
| Breadth check | [04-breadth.txt](./04-proofs/04-breadth.txt) | Verified | `yankees`, `dodgers`, `orioles`, `razorbacks` each return ≥ 1 Baseball hit. |
| CI gate transcript | [04-ci-gates.txt](./04-proofs/04-ci-gates.txt) | Verified | `lint`, `format:check`, `typecheck`, `test:ci` (249/249), `build` all exit 0. |
| Touched-files list | [04-touched-files.txt](./04-proofs/04-touched-files.txt) | Verified | Matches `git diff --name-only origin/main..HEAD`; no forbidden paths. |
| Proof index | [README.md](./04-proofs/README.md) | Verified | Maps each artifact to the FR / success metric it evidences. |

## 3) Validation Issues

None blocking. Two low-severity observations recorded for traceability only:

| Severity | Issue | Impact | Recommendation |
| --- | --- | --- | --- |
| LOW | Task 2.7 originally specified `bombers` as an NCAA-side breadth probe; the actual breadth artifact substitutes `razorbacks` because no NCAA D-I baseball team uses "bombers." The substitution is documented in [04-task-02-proofs.md](./04-proofs/04-task-02-proofs.md) ("Breadth check" artifact). | None — NCAA-side coverage is still proven by a real D-I program (Arkansas Razorbacks). | No action required; rationale already captured in proofs. |
| LOW | Task list reference to `git diff --name-only main..HEAD` (T2.9) compares against the local `main`, which on this machine equals `HEAD` and would return empty. Validation used `origin/main..HEAD` and the touched-files proof was generated the same way. | None — the §6 check is correct against the true merge base. | Optional: future task lists could spell out `origin/main` (or the configured base) explicitly. |

## 4) Evidence Appendix

### Git commits analyzed

```
5be2805 feat(baseball): refresh ESPN catalog + bump cache prefix + release note
6152be8 feat(baseball): register Baseball sport, leagues, and allowlist
```

Both commits include the `Related to T#.0 in Spec 04-spec-tennis-and-baseball` trailer.

### Files changed since origin/main (combined T1.0 + T2.0)

```
README.md
docs/specs/04-spec-tennis-and-baseball/04-audit-tennis-and-baseball.md
docs/specs/04-spec-tennis-and-baseball/04-proofs/04-breadth.txt
docs/specs/04-spec-tennis-and-baseball/04-proofs/04-catalog-counts.md
docs/specs/04-spec-tennis-and-baseball/04-proofs/04-ci-gates.txt
docs/specs/04-spec-tennis-and-baseball/04-proofs/04-task-01-proofs.md
docs/specs/04-spec-tennis-and-baseball/04-proofs/04-task-02-proofs.md
docs/specs/04-spec-tennis-and-baseball/04-proofs/04-touched-files.txt
docs/specs/04-spec-tennis-and-baseball/04-proofs/README.md
docs/specs/04-spec-tennis-and-baseball/04-questions-1-tennis-and-baseball.md
docs/specs/04-spec-tennis-and-baseball/04-spec-tennis-and-baseball.md
docs/specs/04-spec-tennis-and-baseball/04-tasks-tennis-and-baseball.md
lib/espn/catalog.json
lib/espn/catalog.test.ts
lib/espn/client.test.ts
lib/espn/client.ts
lib/espn/leagues.test.ts
lib/espn/leagues.ts
lib/favorites/validators.test.ts
lib/home/cache.test.ts
lib/home/cache.ts
lib/sport-allowlist.test.ts
lib/sport-allowlist.ts
lib/sports/types.ts
```

**File classification (GATE D):**

- **Core** (production code touched): `lib/sports/types.ts`, `lib/espn/client.ts`, `lib/espn/leagues.ts`, `lib/espn/catalog.json`, `lib/sport-allowlist.ts`, `lib/home/cache.ts`. All map to an explicit FR row above.
- **Supporting** (tests, proofs, docs): everything under `lib/**/*.test.ts`, `docs/specs/04-spec-tennis-and-baseball/**`, and `README.md`. Linked to core changes via the proof index and commit trailers.
- **Out-of-scope core changes:** none.

### Success Metric §6 check

```bash
git diff --name-only origin/main..HEAD | grep -E '(lib/home/aggregator\.ts|app/api/home/route\.ts|app/api/favorites/search/route\.ts|^components/)'
# (no output) — exit 1
```

### Catalog spot checks

```bash
jq '.teams | map(select(.sport == "Baseball")) | length' lib/espn/catalog.json  # → 467
jq '.teams | map(select(.leagueKey == "baseball/mlb")) | length' lib/espn/catalog.json  # → 30
jq '.teams | map(select(.leagueKey == "baseball/college-baseball")) | length' lib/espn/catalog.json  # → 437
jq '[.teams[] | .sport] | unique' lib/espn/catalog.json
# → ["American Football","Baseball","Basketball","Soccer"]
jq '.leagues | length' lib/espn/catalog.json  # → 21
```

### CI gate result (excerpt from `04-ci-gates.txt`)

```
Test Files  29 passed (29)
     Tests  249 passed (249)
```

### Security scan

```bash
grep -niE 'api[_-]?key|password|secret|token' docs/specs/04-spec-tennis-and-baseball/04-proofs/*
# (no matches)
```

---

**Validation Completed:** 2026-06-24
**Validation Performed By:** Claude Opus 4.7
