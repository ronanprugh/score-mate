# Spec 06 — Tennis Day-Feed: Proof Bundle Index

This directory contains all proof artifacts for Spec 06 (rendering in-session tennis tournaments on all three day tabs, with correct local-day bucketing and card metadata). Each artifact maps to the functional requirement (FR) or success metric (SM) it evidences.

## Artifact Index

| Artifact | Type | Task | FR / SM Evidenced |
|---|---|---|---|
| `06-task-01-proofs.md` | Proof doc | T1.0 | Unit 1 — per-day `TennisByDay` aggregation, per-day rejection isolation, green typecheck |
| `06-task-02-proofs.md` | Proof doc | T2.0 | Unit 2 — local-day bucketing (DST + date-line), event date span, real round, tz-keyed cache |
| `06-task-03-proofs.md` | Proof doc | T3.0 | Unit 3 — cards on all 3 tabs, counts/empty-state, card metadata display |
| `06-yesterday-tennis.png` | Screenshot | T3.6 | SM §1 — Yesterday tab with an expanded tournament card listing that day's matches |
| `06-ci-gates.txt` | CI transcript | T4.1 | SM §4 — lint, format:check, typecheck, test:ci, build all exit 0 |
| `06-touched-files.txt` | Diff analysis | T4.2 | SM §5 — no team-sport regressions; changes within the tennis/home-feed set |
| `README.md` (this file) | Index | T4.3 | Proof navigation for reviewer |

## Success Metric Coverage

| SM | Description | Evidence |
|---|---|---|
| §1 Per-day coverage | Each tab shows that day's tennis split by tournament | `06-task-03-proofs.md` (Yesterday/Tomorrow tests) + `06-yesterday-tennis.png` |
| §2 Correct bucketing | A match whose UTC date ≠ local date lands on the correct local tab | `06-task-02-proofs.md` (NY + Auckland bucketing tests) |
| §3 Accurate metadata | Card shows real round + full date range | `06-task-02-proofs.md` (aggregator) + `06-task-03-proofs.md` (card display) |
| §4 Green build | All five gates exit 0 | `06-ci-gates.txt` |
| §5 No team-sport regressions | Team-sport fetch/render unchanged | `06-touched-files.txt` + 317-test suite |

## Functional Requirement Coverage

| FR (by Unit) | Where evidenced |
|---|---|
| U1: fetch tennis for yesterday/today/tomorrow | `06-task-01-proofs.md` |
| U1: `HomeEnvelope` carries per-day `TennisByDay` | `06-task-01-proofs.md` |
| U1: per-day rejection → `[]` + `source.errors` | `06-task-01-proofs.md` |
| U2: bucket tennis by local date (tz-aware) | `06-task-02-proofs.md` |
| U2: late-evening match on correct local tab | `06-task-02-proofs.md` |
| U2: only show tournament on days with ≥1 match | `06-task-02-proofs.md` |
| U3: render `TournamentCard` per tournament on all 3 tabs | `06-task-03-proofs.md`, `06-yesterday-tennis.png` |
| U3: counts + empty-state include tennis | `06-task-03-proofs.md` |
| U3: `currentRound` = real round | `06-task-02-proofs.md` |
| U3: date range = tournament run | `06-task-02-proofs.md`, `06-task-03-proofs.md` |
| U3: preserve `TennisMatchCard` layout | `06-yesterday-tennis.png` + existing `tennis-match-card.test.tsx` |
