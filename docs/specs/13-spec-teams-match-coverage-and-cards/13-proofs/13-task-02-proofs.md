# Task 02 Proofs — Multi-competition coverage for team schedules

## Task Summary

ESPN's site-v2 API exposes schedules per league key, with no "all competitions
for this team" endpoint. The app only ever queried a team's *primary* league, so
cup ties, continental fixtures, and friendlies were invisible — the second half
of the reported Liverpool bug ("not showing… even friendlies").

This task adds a static companion-league map and a concurrent fan-out that
merges, dedupes, and tolerates partial failure. Both Teams routes now use it, so
the list and detail screens agree about which matches exist.

## What This Task Proves

- A Premier League team's schedule now draws from 7 competitions: its league,
  both domestic cups, the three UEFA competitions, and friendlies.
- Single-competition sports (NFL, NBA, MLB) are untouched — still one request.
- Friendlies reach a team's card **without** joining the Home feed, so
  Non-Goal #8 holds by construction rather than by convention.
- Requests are concurrent, results are deduped by match id, and a failing
  competition does not suppress the others.
- An empty competition is normal, not an error, and does not flip `source.ok`.
- Cache keys include the season, so a previous-season fallback cannot outlive
  the rollover.

## Evidence Summary

- 18 tests in `lib/espn/leagues.test.ts`, 15 in `lib/teams/schedule.test.ts`,
  4 in `lib/teams/cached-schedule.test.ts`, 23 across the two route suites.
- Mutation testing confirms the retargeted route mocks exercise the live path.
- Full suite: 500/500 passing (up from 470). Typecheck and format clean.

## Artifact: The companion-league map

**What it proves:** The per-team request count is knowable by inspection rather
than emergent from a runtime probe.

**Why it matters:** This is a fan-out on the endpoint Spec 12 spent its scope
optimizing. A reviewer must be able to count the requests without running
anything.

**Artifact path:** `lib/espn/leagues.ts`

**Result summary:** A Premier League team costs 1 primary + 6 companions = 7
concurrent requests. Other big-5 leagues cost 5 (no domestic cups are registered
for them). MLS costs 3. Every other league costs 1, unchanged.

```ts
export const COMPANION_LEAGUE_KEYS: Readonly<
  Record<string, readonly string[]>
> = {
  "soccer/eng.1": [
    "soccer/club.friendly",
    "soccer/eng.fa",
    "soccer/eng.league_cup",
    ...UEFA_COMPETITIONS,
  ],
  "soccer/esp.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/ita.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/ger.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/fra.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/usa.1": ["soccer/club.friendly", "soccer/concacaf.champions"],
};
```

## Artifact: The Home feed is protected structurally

**What it proves:** `soccer/club.friendly` resolves a display name but never
enters `leagueKeysForSport`, which is what the Home aggregator fans out over.

**Why it matters:** The planning audit flagged this as the highest-risk item.
Registering friendlies in `SUPPORTED_LEAGUES` — the obvious implementation —
would have added a league × 5 dates to `/api/home` and put friendly fixtures in
the Home feed of every user following a soccer sport, violating Non-Goal #8.
The split makes that mistake impossible rather than merely discouraged.

**Command:**

```bash
pnpm test:ci lib/espn/leagues.test.ts
```

**Result summary:** 18 tests pass. The guard asserts both the absence from the
fan-out set and the presence in name resolution.

```text
✓ resolves a companion-only league so friendlies get a display name
✓ keeps club.friendly out of the Home aggregator's fan-out
✓ gives a Premier League team friendlies, both domestic cups, and the three UEFA competitions
✓ returns no companions for single-competition sports
✓ returns no companions for an unknown league key
✓ returns a fresh array so callers cannot mutate the shared map
✓ every companion key resolves to a known league

 Tests  18 passed (18)
```

## Artifact: Fan-out, merge, and failure behaviour

**What it proves:** Concurrency, dedupe by match id, partial-failure tolerance,
and the "empty is not an error" rule.

**Why it matters:** These are the properties the latency budget and the error
banner both depend on. Sequential requests would make cold latency scale with
league count; treating an empty cup as an error would show a spurious banner to
every user whose team is not in Europe.

**Command:**

```bash
pnpm test:ci lib/teams/schedule.test.ts
```

**Result summary:** 15 tests pass. The concurrency test asserts all 7 requests
are in flight simultaneously, not merely that they complete.

```text
✓ merges matches from the primary league and every companion
✓ requests the primary league plus its six companions for a PL team
✓ requests only the primary league for a single-competition sport
✓ dedupes a fixture that appears under more than one league key
✓ issues every league request concurrently
✓ records an error but keeps the other competitions when one league fails
✓ treats an empty companion league as normal, not an error
✓ returns no matches and every error when all leagues fail
✓ picks the chronologically most recent completed match across competitions
✓ selects a friendly over an older league fixture — no preference for competitive matches
✓ picks the soonest upcoming match across competitions
✓ returns nulls for an empty schedule
✓ ignores live matches for both sides
✓ falls back to dateUtc when kickoffUtc is unknown
✓ agrees with splitAndCapSchedule about which match is most recent

 Tests  15 passed (15)
```

## Artifact: Season-scoped cache keys

**What it proves:** Each (league, team, season) triple caches independently.

**Why it matters:** This closes REQUIRED failure #1 from the planning audit. A
key missing the season would let a previous-season fallback result be served
after the new season publishes fixtures — converting the empty screen this spec
fixes into a stale one, which is harder to diagnose.

**Command:**

```bash
pnpm test:ci lib/teams/cached-schedule.test.ts
```

**Result summary:** 4 tests pass, asserting key composition and that season,
league, and team each independently partition the keyspace.

```text
✓ includes the league key, team id, and season
✓ produces distinct keys for two seasons
✓ produces distinct keys per competition so leagues cache independently
✓ produces distinct keys per team

 Tests  4 passed (4)
```

## Artifact: Mutation check — the retargeted route mocks test the live path

**What it proves:** After rewiring both routes from `teamScheduleForLeague` to
`teamScheduleAcrossCompetitions`, their suites still fail when the routes break.

**Why it matters:** This is REQUIRED failure #2 from the planning audit, and the
specific risk it named: mocks pointing at an export the route no longer calls
would leave both suites green while testing nothing. Re-running them unchanged
proves nothing; breaking the route on purpose does.

**Method:** Inject `matches.length = 0` after the fan-out in both routes, run,
revert.

**Result summary:** 7 of 23 route tests fail under the mutation and all 23 pass
once reverted. The mocks are wired to the live path.

```text
--- MUTATION: routes discard the fan-out matches
      Tests  7 failed | 16 passed (23)

--- RESTORED
      Tests  23 passed (23)
```

## Artifact: Coverage parity between the two Teams screens

**What it proves:** A friendly returned by a companion league reaches both
`/api/teams` and `/api/teams/[favoriteId]/matches`.

**Why it matters:** Spec Non-Goal #1 was amended so the detail screen shares the
data layer. Without a test, the two screens could silently diverge — and
divergence would read to a user as a fresh bug.

**Result summary:** Both route suites assert a `Club Friendly` fixture dated
after the last league match is selected/returned, and that `source.ok` stays
`true` when it is.

```text
✓ selects a friendly as the last match when it is the most recent fixture      (/api/teams)
✓ surfaces a friendly from a companion league, matching /api/teams coverage    (detail route)
✓ reports a partial competition failure while keeping the matches that resolved (/api/teams)
✓ reports a partial competition failure without dropping the other competitions (detail route)
```

## Artifact: Repository quality gates

**Command:**

```bash
pnpm typecheck && pnpm format:check && pnpm test:ci
```

**Result summary:** Typecheck clean, format clean, 500/500 tests across 48
files — up from 470/46 at Task 1.0.

```text
$ tsc --noEmit
(no output)

$ prettier --check .
All matched files use Prettier code style!

 Test Files  48 passed (48)
      Tests  500 passed (500)
```

`pnpm lint` still reports the same 1 error + 2 warnings documented in
`13-task-01-proofs.md`, all pre-existing on `main` and untouched by this task.

## Observations for Task 5.0

Two things the latency measurement should watch, both consequences of design
decisions made here rather than defects:

1. **Empty competitions cost two requests, not one.** A team not in the Europa
   League returns zero events for the current season, which triggers Task 1.0's
   previous-season fallback — also empty. So the worst-case cold fan-out for a
   Premier League team is 7 competitions × 2 seasons = 14 requests, not 7. They
   are concurrent, so wall-clock cost should stay near the slowest single call,
   but this is the number to check against the 1 200 ms cold budget.
2. **Warm path should be unaffected.** Each (league, team, season) caches
   independently for 300 s, so a warm request reads 7 cache entries rather than
   issuing 7 requests.

## Reviewer Conclusion

A followed team's matches now come from every competition they actually play,
merged and deduped, with partial upstream failure degrading to "fewer
competitions" rather than "no matches". The Home feed is protected by
construction, not by comment. Both audit-flagged risks — an unprotected Home
fan-out and mocks that could quietly stop testing anything — are closed with
evidence rather than assertion.
