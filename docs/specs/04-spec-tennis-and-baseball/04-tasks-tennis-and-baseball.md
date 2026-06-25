# 04-tasks-tennis-and-baseball.md

Implementation task list for [04-spec-tennis-and-baseball.md](./04-spec-tennis-and-baseball.md).

> **Scope reminder:** this spec ships **baseball only** (Q1 (A)). Tennis is deferred to a separate Spec 05 with its own per-tournament ingestion design. The directory name is retained for traceability with the original request.

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/sports/types.ts` | MODIFY. Add `"Baseball"` to the `Sport` union and to `SUPPORTED_SPORTS`. |
| `lib/espn/client.ts` | MODIFY. Add `baseball` → `"Baseball"` entry to `SPORT_FROM_SEGMENT` so `sportFromLeagueKey("baseball/mlb")` resolves. |
| `lib/espn/client.test.ts` | MODIFY. Extend the `sportFromLeagueKey` table to include `baseball/mlb` and `baseball/college-baseball`. |
| `lib/espn/leagues.ts` | MODIFY. Append `baseball/mlb` and `baseball/college-baseball` to `SUPPORTED_LEAGUES`. |
| `lib/espn/leagues.test.ts` | MODIFY. Update count expectations (was 2 + 3 + 14 = 19, becomes 2 + 3 + 14 + 2 = 21); add `leagueKeysForSport("Baseball")` and `findSupportedLeague("baseball/mlb")` cases. |
| `lib/sport-allowlist.ts` | MODIFY. Add a `Baseball` block to `SPORT_ALLOWLIST` with MLB + College World Series entries. |
| `lib/sport-allowlist.test.ts` | MODIFY. Add Baseball positive (MLB by leagueId) and negative (NPB) cases; extend the "every supported sport has ≥1 entry" loop. |
| `lib/favorites/validators.test.ts` | MODIFY. Move `"Baseball"` from the rejected-sports set to the accepted-sports set. (The validator itself is driven by `SUPPORTED_SPORTS`; no code change in `validators.ts`.) |
| `lib/espn/catalog.json` | MODIFY. Regenerate via `pnpm tsx scripts/refresh-espn-catalog.ts` so it includes all MLB + NCAA D-I baseball teams. |
| `lib/espn/catalog.test.ts` | MODIFY. Update the "exactly three v1 sports" assertion to "exactly four v1 sports" including Baseball; bump the team-count floor; add at least one breadth assertion (e.g. `searchCatalogTeams("yankees")` returns a Baseball team). |
| `lib/home/cache.ts` | MODIFY. Bump `CACHE_KEY_PREFIX` from `"v5-espn-shortname"` to `"v6-espn-baseball"`. |
| `lib/home/cache.test.ts` | MODIFY. Update the prefix-assertion test to expect `"v6-espn-baseball"`. |
| `README.md` | MODIFY. Append a one-line entry under **Operations → Release notes** referencing this spec. |
| `docs/specs/04-spec-tennis-and-baseball/04-proofs/` | NEW. Evidence bundle directory (CI transcript, catalog counts, breadth check). |

### Notes

- Tests are colocated next to their source files per `AGENTS.md`.
- Run `pnpm test:ci` locally to verify; CI runs `lint → format:check → typecheck → test:ci → build`.
- All commits use Conventional Commits with `Related to T#.# in Spec 04-spec-tennis-and-baseball` in the body.
- No new runtime dependencies. No DB migration (`favorites.sport` is a free-text column).
- The aggregator, route handlers, and UI components are intentionally NOT in this table — Success Metric §6 forbids touching them.

## Tasks

### [x] 1.0 Sport / league / allowlist additions

Teach the type system, the ESPN sport-segment decoder, the league registry, the sport allowlist, and the favorites validator that Baseball exists. Pure code change — no data, no aggregator, no UI. Maps Spec Unit 1.

#### 1.0 Proof Artifact(s)

- Test: `pnpm test:ci` passes (was 241/241 pre-spec), including new assertions in `lib/espn/leagues.test.ts` that `leagueKeysForSport("Baseball")` returns `["baseball/mlb", "baseball/college-baseball"]` and `findSupportedLeague("baseball/mlb")` returns its entry.
- Test: `lib/espn/client.test.ts` covers `sportFromLeagueKey("baseball/mlb") === "Baseball"` and `sportFromLeagueKey("baseball/college-baseball") === "Baseball"`.
- Test: `lib/sport-allowlist.test.ts` adds a positive case (a `match.leagueId === "baseball/mlb"` match for `Sport=Baseball` returns true) and a negative case (an `NPB` league name does NOT match).
- Test: `lib/favorites/validators.test.ts` accepts `"Baseball"` and continues to reject `"Tennis"`.
- CLI: `pnpm typecheck` clean — confirms the new `Sport` value propagates through every consumer with no `any` escape hatches.

#### 1.0 Tasks

- [x] 1.1 Add `"Baseball"` to the `Sport` union in `lib/sports/types.ts` and to the `SUPPORTED_SPORTS` readonly array (preserve alphabetical order if the existing array is alphabetical, otherwise append).
- [x] 1.2 Add the `baseball` segment mapping to `SPORT_FROM_SEGMENT` in `lib/espn/client.ts` (`baseball: "Baseball"`). Update the doc-comment that lists supported segments.
- [x] 1.3 Extend the `sportFromLeagueKey` `it.each` table in `lib/espn/client.test.ts` to include `["baseball/mlb", "Baseball"]` and `["baseball/college-baseball", "Baseball"]`. Update the URL-builder regex test in `lib/espn/leagues.test.ts` if it pins the allowed segment set.
- [x] 1.4 Append two entries to `SUPPORTED_LEAGUES` in `lib/espn/leagues.ts`: `{ leagueKey: "baseball/mlb", sport: "Baseball", displayName: "MLB" }` and `{ leagueKey: "baseball/college-baseball", sport: "Baseball", displayName: "NCAA Baseball" }`. Place them in the same grouping pattern (`// Baseball` comment block, mirroring `// American Football`, `// Basketball`, `// Soccer`).
- [x] 1.5 Update `lib/espn/leagues.test.ts`: change the "exactly the v1 set: 2 + 3 + 14" assertion to "2 + 3 + 14 + 2 = 21"; add a Baseball count check (`leagueKeysForSport("Baseball").length === 2`); add a `findSupportedLeague("baseball/mlb")` happy-path case; keep the "no Tennis" assertion (still passing).
- [x] 1.6 Add a `Baseball` block to `SPORT_ALLOWLIST` in `lib/sport-allowlist.ts` with at minimum: `{ leagueId: "baseball/mlb", label: "MLB" }` and `{ leagueNameContains: "College World Series", label: "College World Series" }`. Update the doc-comment header that lists which sports are allowlisted.
- [x] 1.7 Extend `lib/sport-allowlist.test.ts`: add `"Baseball"` to the "every supported sport has ≥1 entry" iteration; add a positive case (`Baseball` match with `leagueId: "baseball/mlb"` → true); add a negative case (`Baseball` match with `leagueName: "NPB Pacific League"` → false). Update the existing "no Tennis allowlist" test to ALSO assert Baseball is present.
- [x] 1.8 Update `lib/favorites/validators.test.ts`: move `"Baseball"` out of the `it.each([..., "Tennis"])("rejects %s")` set and into the `it.each(["Soccer", "American Football", "Basketball"])("accepts %s")` set. The validator itself (`lib/favorites/validators.ts`) needs no edit because its Zod schema is built from `SUPPORTED_SPORTS`.
- [x] 1.9 Run `pnpm lint && pnpm typecheck && pnpm test:ci`. Commit using `feat(baseball): register Baseball sport, leagues, and allowlist` with body `Related to T1.0 in Spec 04-spec-tennis-and-baseball`.

### [x] 2.0 Catalog refresh + cache prefix bump + release note

Refresh the committed `lib/espn/catalog.json` so baseball teams appear in the favorites typeahead, bump the homepage cache prefix so existing cached planning results don't suppress baseball, and add a one-line README release note. Depends on T1.0 (the refresh script reads `SUPPORTED_LEAGUES`). Maps Spec Unit 2.

#### 2.0 Proof Artifact(s)

- File: `lib/espn/catalog.json` committed; `jq '.teams | map(select(.sport == "Baseball")) | length' lib/espn/catalog.json` returns ≥ 250 and `jq '[.teams[] | .sport] | unique' lib/espn/catalog.json` lists exactly `["American Football", "Baseball", "Basketball", "Soccer"]`.
- File: per-league baseball counts recorded in `docs/specs/04-spec-tennis-and-baseball/04-proofs/04-catalog-counts.md` (MLB row + NCAA D-I row + total).
- CLI: node one-liner against `catalog.json` confirms `yankees`, `dodgers`, `orioles` each return ≥ 1 Baseball team; output captured to `04-proofs/04-breadth.txt`.
- CLI: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build` all exit 0; transcript saved to `04-proofs/04-ci-gates.txt`.
- Test: `lib/home/cache.test.ts` asserts the new `CACHE_KEY_PREFIX === "v6-espn-baseball"`.
- Diff: `README.md` shows the new "Release notes" line referencing this spec.
- Diff: `git diff main` excludes `lib/home/aggregator.ts`, `app/api/home/route.ts`, `app/api/favorites/search/route.ts`, and `components/**` (Success Metric §6).

#### 2.0 Tasks

- [x] 2.1 Execute `pnpm tsx scripts/refresh-espn-catalog.ts` to regenerate `lib/espn/catalog.json`. Confirm the per-league summary log shows `✓ baseball/mlb: 30 teams` and `✓ baseball/college-baseball: ~290 teams` (exact number recorded as-observed) with zero errors.
- [x] 2.2 Update `lib/espn/catalog.test.ts`:
  - Bump the team-count floor (currently ≥ 500) to ≥ 1900 to reflect the expanded catalog.
  - Change `expect(sports).toEqual(new Set(["American Football", "Basketball", "Soccer"]))` to include `"Baseball"`.
  - Bump the league count from 19 to 21.
  - Add at least one Baseball assertion: `searchCatalogTeams("yankees")` returns ≥ 1 team with `sport === "Baseball"` and `leagueKey === "baseball/mlb"`.
- [x] 2.3 Bump `CACHE_KEY_PREFIX` in `lib/home/cache.ts` from `"v5-espn-shortname"` to `"v6-espn-baseball"`. Update the doc-comment one-liner that explains the prefix rationale.
- [x] 2.4 Update the prefix assertion in `lib/home/cache.test.ts` to expect `"v6-espn-baseball"` with a one-line rationale comment referencing this spec.
- [x] 2.5 Append a one-line entry to `README.md` under **Operations → Release notes**: a 2026-MM-DD-prefixed line referencing Spec 04 and noting that Baseball (MLB + NCAA D-I) is now supported, with the cache-prefix bump as the deploy mechanism.
- [x] 2.6 Create `docs/specs/04-spec-tennis-and-baseball/04-proofs/04-catalog-counts.md` with per-league baseball team counts captured from T2.1's run.
- [x] 2.7 Write the breadth check: a small node one-liner against the committed `catalog.json` that asserts `yankees`, `dodgers`, `orioles` (plus `bombers` as a NCAA-side sanity check) each return ≥ 1 Baseball team; capture output to `04-proofs/04-breadth.txt`.
- [x] 2.8 Run the full CI gate suite locally: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`. Capture transcript to `04-proofs/04-ci-gates.txt`.
- [x] 2.9 Verify Success Metric §6: run `git diff --name-only main..HEAD` (after committing both T1 and T2) and confirm the output does NOT include `lib/home/aggregator.ts`, `app/api/home/route.ts`, `app/api/favorites/search/route.ts`, or any path under `components/`. Capture the file list to `04-proofs/04-touched-files.txt`.
- [x] 2.10 Write `04-proofs/README.md` indexing every artifact (CI transcript, catalog counts, breadth output, touched-files list) with a column mapping each to the spec FR or success metric it evidences.
- [x] 2.11 Commit using `feat(baseball): refresh ESPN catalog + bump cache prefix + release note` with body `Related to T2.0 in Spec 04-spec-tennis-and-baseball`.
