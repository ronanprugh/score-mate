# Spec 05 — Tennis Support: Proof Bundle Index

This directory contains all proof artifacts for Spec 05. Each artifact is mapped below to the functional requirement (FR) or success metric (SM) it evidences.

## Artifact Index

| Artifact | Type | Task | FR / SM Evidenced |
|---|---|---|---|
| `05-endpoint-verify.txt` | CLI transcript | T1.9–T1.10 | SM §1 (endpoint pressure); FR: 23 marquee tournament endpoints return HTTP 200 |
| `05-task-01-proofs.md` | Proof doc | T1.0 | FR: Tennis Sport union, SPORT_FROM_SEGMENT mapping, marquee registry (23 entries), scoreboard client, validator acceptance, allowlist skip |
| `05-task-02-proofs.md` | Proof doc | T2.0 | FR: active-tournament aggregator, cache prefix bump to `v7-espn-tennis`, 1h cache layer, `HomeEnvelope.activeTennisTournaments` |
| `05-task-03-proofs.md` | Proof doc | T3.0 | FR: TournamentCard collapsed/expanded, MatchCard player-vs-player, homepage mixed-feed sort |
| `05-task-04-proofs.md` | Proof doc | T4.0 | FR: catalog 21→44 leagues, Tennis typeahead results, `type: "event"` translation, round-trip add/list |
| `05-search-tennis.png` | Screenshot | T4.5 | SM §4 (favorites stability); typeahead shows Tennis tournaments with `Event · Tennis` label |
| `05-favorite-added.png` | Screenshot | T4.5 | SM §4; Wimbledon row shows "Added" state after successful POST |
| `05-ci-gates.txt` | CI transcript | T5.2 | SM §5: lint, format:check, typecheck, test:ci, build all exit 0 |
| `05-touched-files.txt` | Diff analysis | T5.3 | SM §6: no edits outside the allowed file set |
| `README.md` (this file) | Index | T5.4 | Proof navigation for reviewer |

## Success Metric Coverage

| SM | Description | Evidence |
|---|---|---|
| §1 Coverage | Homepage shows exactly one tournament card for an active Slam | `05-task-03-proofs.md` → TournamentCard fixture test; `05-task-02-proofs.md` → aggregator only returns tournaments with ≥1 match |
| §2 Endpoint pressure | `getActiveTennisTournaments` returns `[]` when no active tournaments | `05-task-02-proofs.md` → aggregator test: tournaments returning empty are filtered out |
| §3 Cache invalidation | `CACHE_KEY_PREFIX === "v7-espn-tennis"` | `05-task-02-proofs.md` → cache.test.ts assertion |
| §4 Favorites stability | Year-less id `tennis/slam/wimbledon` valid across years without migration | `05-task-04-proofs.md` → catalog test, validator test, round-trip screenshot |
| §5 CI gates green | All gates exit 0 | `05-ci-gates.txt` |
| §6 Scope discipline | No forbidden file edits | `05-touched-files.txt` |

## Functional Requirement Coverage

| FR | Where evidenced |
|---|---|
| Tennis added to Sport union + SUPPORTED_SPORTS | `05-task-01-proofs.md` |
| `sportFromLeagueKey("tennis/...")` → `"Tennis"` | `05-task-01-proofs.md` |
| 23 marquee tournaments registered with correct ids | `05-task-01-proofs.md`, `05-endpoint-verify.txt` |
| `tennisScoreboard(id, date)` parses ESPN JSON to Match[] | `05-task-01-proofs.md` |
| `getActiveTennisTournaments` filters empty tournaments | `05-task-02-proofs.md` |
| liveCount / upcomingCount / doneCount correct | `05-task-02-proofs.md` |
| Cache prefix bumped to `v7-espn-tennis` | `05-task-02-proofs.md` |
| `HomeEnvelope.activeTennisTournaments` populated | `05-task-02-proofs.md` |
| TournamentCard collapsed state (name, dates, round, counts) | `05-task-03-proofs.md` |
| TournamentCard expanded state (MatchCard rows) | `05-task-03-proofs.md` |
| MatchCard player-vs-player (no logos, full names) | `05-task-03-proofs.md` |
| Homepage mixed-feed sort using earliest live/upcoming kickoff | `05-task-03-proofs.md` |
| Tennis catalog: 44 total leagues (21 + 23 Tennis) | `05-task-04-proofs.md` |
| Search route returns `type: "event"` for Tennis entries | `05-task-04-proofs.md` |
| Favorites round-trip: add → list → render | `05-task-04-proofs.md`, `05-favorite-added.png` |
