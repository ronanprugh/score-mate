# 06-tasks-tennis-day-feed.md

Implementation task list for [06-spec-tennis-day-feed.md](./06-spec-tennis-day-feed.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/home/aggregator.ts` | MODIFY. Home envelope + `aggregateMatchesForUser`. Finalize `TennisByDay`, fetch tennis for all 3 local days, thread `tz` to the tennis fetcher, build per-day result. Holds `localDateOfMatch` reused for bucketing. |
| `lib/home/aggregator.test.ts` | MODIFY. Cover per-day tennis population, per-day rejection isolation, `EMPTY_ENVELOPE` shape, new `TennisByDay` envelope field. |
| `lib/home/tennis-aggregator.ts` | MODIFY. `getActiveTennisTournaments` / `ActiveTournament`. Set `startDate`/`endDate` from the tournament's overall event span; set `currentRound` from the real round (`match.tennis.round`). |
| `lib/home/tennis-aggregator.test.ts` | MODIFY. Assert date range = event span, `currentRound` = real round, per-day separation. |
| `lib/espn/tennis.ts` | MODIFY. `tennisScoreboard`: add `tz` to client options; bucket competitions by **local** date instead of strict UTC; preserve dedupe + whole-draw handling; surface the tournament's overall date span. |
| `lib/espn/tennis.test.ts` | MODIFY. Add local-date bucketing case (UTC date ≠ local date), event-span return; keep dedupe + date-filter cases green. |
| `lib/home/cache.ts` | MODIFY. `makeCachedFetchers` + `cachedActiveTennisTournaments`: thread `tz`; include `tz` in the cache key so bucketing stays correct per timezone. |
| `lib/home/cache.test.ts` | MODIFY. Assert the tennis cache key includes the date and `tz`. |
| `components/home-client.tsx` | MODIFY. Read per-day tennis (`envelope.activeTennisTournaments[activeDay]`); render `TournamentCard`s on all 3 tabs; include tennis in day counts + empty-state; fix the leftover `totalMatches` reference. |
| `components/home-client.test.tsx` | MODIFY. Assert tournament cards render on Yesterday/Tomorrow tabs (present/absent), only-tennis day is not empty + count includes the tournament; update envelope fixtures to `TennisByDay`. |
| `components/tournament-card.tsx` | MODIFY. Display the real `currentRound` and the tournament's date range (event span); keep the responsive expanded-match grid. |
| `components/tournament-card.test.tsx` | MODIFY. Assert the card shows the real round and the event date range. |
| `app/api/home/route.test.ts` | MODIFY. Update `EMPTY_ENVELOPE` + tennis fetcher mock to the `TennisByDay` shape. |
| `docs/specs/06-spec-tennis-day-feed/06-proofs/` | NEW. Evidence bundle (CI transcript, touched-files list, screenshot, proof index, task proof markdowns). |

### Notes

- Tests are colocated next to their source files per `AGENTS.md`.
- Run `pnpm test:ci` locally; CI runs `lint → format:check → typecheck → test:ci → build`.
- All commits use Conventional Commits with `Related to T#.# in Spec 06-spec-tennis-day-feed` in the body.
- No new runtime dependencies. No DB migration.
- The working tree starts mid-refactor (a partial `TennisByDay` change); Task 1.0 completes it so the build goes green before further work.

## Tasks

### [x] 1.0 Per-day tennis aggregation in the home envelope

Maps Spec Unit 1. Complete the half-finished `TennisByDay` refactor so the homepage data layer fetches active tennis tournaments for yesterday, today, and tomorrow, carries them on `HomeEnvelope` as a per-day structure, handles per-day fetch rejection gracefully, and type-checks cleanly. Pure data layer — no UI behavior change beyond reading the new shape. Commits with body `Related to T1.0 in Spec 06-spec-tennis-day-feed`.

#### 1.0 Proof Artifact(s)

- CLI: `pnpm typecheck` exits 0 demonstrates the `TennisByDay` refactor is internally consistent across producers and consumers.
- Test: `lib/home/aggregator.test.ts` asserts the envelope carries tennis under `yesterday`/`today`/`tomorrow`, each populated from the fetcher, demonstrates per-day aggregation.
- Test: `lib/home/aggregator.test.ts` asserts a single day's tennis fetch rejection yields `[]` for that day plus a `source.errors` entry while the other days still populate, demonstrates partial-failure isolation.
- Test: `app/api/home/route.test.ts` updated to the new envelope shape passes, demonstrates the route contract still holds.

#### 1.0 Tasks

- [x] 1.1 In `lib/home/aggregator.ts`, finalize the `TennisByDay` interface and `emptyTennisByDay()` helper; confirm `HomeEnvelope.activeTennisTournaments: TennisByDay`, and that `EMPTY_ENVELOPE` and the `buildHomeEnvelope` default parameter both use `emptyTennisByDay()`.
- [x] 1.2 In `aggregateMatchesForUser`, fetch tennis for `dates.yesterday`, `dates.today`, and `dates.tomorrow` in parallel (within the existing `Promise.all`/`allSettled`), and assemble the `TennisByDay` result via the `tournamentsOrError` helper (per-day rejection → `[]` + `source.errors`).
- [x] 1.3 In `lib/home/cache.ts`, confirm `makeCachedFetchers` wires `activeTennisTournaments` to `cachedActiveTennisTournaments` and that the fetcher is invoked once per day (tz threading is added in Task 2).
- [x] 1.4 In `components/home-client.tsx`, pass `envelope.activeTennisTournaments[activeDay]` to `DayPanel`, replace the dangling `totalMatches` reference with the per-day item totals, and compute `counts`/`showEmpty` from matches **plus** that day's tennis.
- [x] 1.5 Update `app/api/home/route.test.ts`: change `EMPTY_ENVELOPE.activeTennisTournaments` and the `makeCachedFetchers` mock to the `{ yesterday: [], today: [], tomorrow: [] }` shape.
- [x] 1.6 Update `lib/home/aggregator.test.ts`: assert per-day population from the fetcher, per-day rejection isolation (one day `[]` + `source.errors`, others populated), and `EMPTY_ENVELOPE` carries the per-day shape.
- [x] 1.7 Update `components/home-client.test.tsx` envelope builder/fixtures to the `TennisByDay` shape so the file type-checks (full rendering assertions land in Task 3).
- [x] 1.8 Run `pnpm typecheck` (must be clean) and `pnpm test:ci`; commit `feat(tennis): per-day tennis in home envelope` with body `Related to T1.0 in Spec 06-spec-tennis-day-feed`.

### [x] 2.0 Local-day bucketing + accurate tournament metadata

Maps Spec Unit 2 (and the metadata half of Unit 3's data). Make `tennisScoreboard` timezone-aware so competitions are bucketed by the user's local date (not UTC), preserve Spec 05's dedupe + whole-draw safeguards, surface each tournament's overall date span, and derive `currentRound` from the real round. Commits with body `Related to T2.0 in Spec 06-spec-tennis-day-feed`.

#### 2.0 Proof Artifact(s)

- Test: `lib/espn/tennis.test.ts` feeds a competition whose `date` (UTC) falls on a different day than the user's local day and asserts it is included for the matching **local** date and excluded otherwise, demonstrates the off-by-one bucketing fix.
- Test: `lib/espn/tennis.test.ts` dedupe + whole-draw cases still pass, demonstrates Spec 05 safeguards are preserved.
- Test: `lib/home/tennis-aggregator.test.ts` asserts `startDate`/`endDate` equal the tournament's overall event span (not a single day) and `currentRound` equals the real round, demonstrates the metadata fixes.
- CLI: `pnpm test:ci` exits 0, demonstrates no regressions.

#### 2.0 Tasks

- [x] 2.1 Thread timezone: extend the tennis fetcher signature so `tz` reaches it (`Fetchers.activeTennisTournaments: (day, tz) => Promise<ActiveTournament[]>`), pass the aggregator's `tz`, and include `tz` in the `cachedActiveTennisTournaments` cache key (`lib/home/cache.ts`). Keep the change **additive and tennis-only**: do not alter `eventsLeagueDay` or any team-sport fetcher/cache signature or behavior.
- [x] 2.2 In `lib/espn/tennis.ts`, add `tz` to `TennisClientOptions`; replace the strict UTC `comp.date.slice(0,10) === date` filter with a local-date comparison that converts each competition's UTC timestamp to its local date via `tz` (extract a small `localDateOf(iso, tz)` helper consistent with `localDateOfMatch`); default `tz` to `"UTC"`.
- [x] 2.3 In `lib/espn/tennis.ts`, capture the tournament's overall date span (min/max `comp.date` across the **unfiltered** draw) and return it alongside the matches (e.g. `tennisScoreboard` returns `{ matches, eventStartDate, eventEndDate }`); update `TennisScoreboardFetcher` and callers accordingly. Keep the dedupe-by-id behavior.
- [x] 2.4 In `lib/home/tennis-aggregator.ts`, set `ActiveTournament.startDate`/`endDate` from the returned event span; set `currentRound` from the first match's `tennis.round` (real round), falling back to `match.round` when absent.
- [x] 2.5 Update `lib/espn/tennis.test.ts`: add a tz-driven local-date bucketing case (UTC date ≠ local date), assert the event span is returned, and keep the dedupe + existing parse cases green. Include at least one **edge-timezone** case (a DST-observing or near-date-line zone, e.g. `America/New_York` around a late-evening UTC-rollover match) so the bucketing is proven beyond a single offset.
- [x] 2.6 Update `lib/home/tennis-aggregator.test.ts`: assert `startDate`/`endDate` = event span, `currentRound` = real round, and per-day match separation.
- [x] 2.7 Update `lib/home/cache.test.ts` to assert the tennis cache key includes the date and `tz`, and that two different `tz` values for the same date produce **distinct** cache keys (guards correctness of per-timezone bucketing).
- [x] 2.8 Run `pnpm test:ci`; commit `fix(tennis): local-day bucketing + event date range + real round` with body `Related to T2.0 in Spec 06-spec-tennis-day-feed`.

### [x] 3.0 Per-day tennis rendering and card metadata display

Maps Spec Unit 3. Render one `TournamentCard` per in-session tournament on all three day tabs (split by tournament), include tennis in the day-tab counts and empty-state decision, and display the corrected round + date range on the card. Preserve the approved `TennisMatchCard` layout inside expanded cards. Commits with body `Related to T3.0 in Spec 06-spec-tennis-day-feed`.

#### 3.0 Proof Artifact(s)

- Test: `components/home-client.test.tsx` asserts tournament cards render on the Yesterday and Tomorrow tabs when those days have tennis, and are absent when they do not, demonstrates the core per-day rendering fix.
- Test: `components/home-client.test.tsx` asserts a day with only tennis (no team matches) is not shown as the empty state and its tab count includes the tournament, demonstrates the counts/empty-state fix.
- Test: `components/tournament-card.test.tsx` asserts the card shows the real round (not the draw name) and the tournament's date range, demonstrates the metadata display fixes.
- Screenshot: `docs/specs/06-spec-tennis-day-feed/06-proofs/06-yesterday-tennis.png` showing the Yesterday tab with an expanded tournament card listing that day's matches, demonstrates the end-to-end design.

#### 3.0 Tasks

- [x] 3.1 In `components/home-client.tsx`, render `TournamentCard`s for the active day on **all** tabs: keep Today's mixed sorted feed; for Yesterday/Tomorrow render that day's tournament cards (full-width) above the league-grouped matches.
- [x] 3.2 Ensure the day-tab `counts` and the `showEmpty`/`NoFavoritesPrompt` decision include that day's tennis tournaments, so a day with only tennis is not shown as empty.
- [x] 3.3 In `components/tournament-card.tsx`, render `currentRound` (now the real round) and the date range (now the event span); confirm the expanded match list still uses the responsive multi-column grid and `TennisMatchCard`.
- [x] 3.4 Update `components/home-client.test.tsx`: assert tournament cards appear on Yesterday/Tomorrow when present and are absent when that day's tennis is `[]`; assert an only-tennis day renders content (not the empty state) and its tab count includes the tournament.
- [x] 3.5 Update `components/tournament-card.test.tsx`: assert the card shows the real round and the event date range.
- [x] 3.6 Capture `docs/specs/06-spec-tennis-day-feed/06-proofs/06-yesterday-tennis.png` — the Yesterday tab with an expanded tournament card showing that day's matches (devtools/fixture render acceptable if no live tournament is in session; redact any account email).
- [x] 3.7 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`; commit `feat(tennis): render tournament cards on all day tabs` with body `Related to T3.0 in Spec 06-spec-tennis-day-feed`.

### [x] 4.0 Full CI gate verification + proof bundle

Maps Spec Success Metrics §4–§5. Run the complete CI gate suite, capture the transcript, verify no out-of-scope or team-sport regressions, and assemble the proof bundle. Commits with body `Related to T4.0 in Spec 06-spec-tennis-day-feed`.

#### 4.0 Proof Artifact(s)

- File: `docs/specs/06-spec-tennis-day-feed/06-proofs/06-ci-gates.txt` — full transcript of `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`, all gates exit 0, demonstrates Success Metric §4.
- File: `docs/specs/06-spec-tennis-day-feed/06-proofs/06-touched-files.txt` — `git diff --name-only` output confirming only tennis/home-feed files and their tests changed, demonstrates Success Metric §5 (no team-sport behavior changes).
- File: `docs/specs/06-spec-tennis-day-feed/06-proofs/README.md` — proof index mapping each artifact to the FR/metric it evidences.
- Test: full `pnpm test:ci` run shows existing non-tennis homepage tests (e.g. `app/api/home/route.test.ts`, team-sport `match-card` / `home-client` cases) still pass unchanged, demonstrates no team-sport regression.

#### 4.0 Tasks

- [x] 4.1 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`; capture the full transcript to `docs/specs/06-spec-tennis-day-feed/06-proofs/06-ci-gates.txt`.
- [x] 4.2 Run `git diff --name-only` (vs the pre-spec baseline) and write `docs/specs/06-spec-tennis-day-feed/06-proofs/06-touched-files.txt` with a header note confirming changes stay within the tennis/home-feed file set. Explicitly verify the team-sport path is unchanged: `git diff` shows no behavioral edits to `eventsLeagueDay`, the league fan-out, or `MatchCard`/league-grouping rendering — only additive tennis/`tz` threading.
- [x] 4.3 Write `docs/specs/06-spec-tennis-day-feed/06-proofs/README.md` indexing every artifact with a column mapping each to the FR or success metric it evidences; add task proof markdowns (`06-task-01-proofs.md` … `06-task-03-proofs.md`) with the recommended structure and the inlined screenshot.
- [x] 4.4 Commit `docs(tennis): proof bundle for Spec 06` with body `Related to T4.0 in Spec 06-spec-tennis-day-feed`.
