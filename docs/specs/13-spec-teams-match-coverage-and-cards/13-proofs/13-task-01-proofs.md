# Task 01 Proofs — Season-aware team schedule fetching

## Task Summary

The Teams screen showed "Match data unavailable" for Liverpool despite a full
completed season existing upstream. Root cause: `teamScheduleForLeague` sent no
`season` parameter, so ESPN resolved to the *upcoming* 2026-27 season — which has
no fixtures published — and answered `200` with `events: []`. An empty array is
not an error, so nothing failed loudly; the screen just went blank.

This task makes the season explicit and adds a single bounded retry at
`currentYear - 1`, inside the one shared helper both Teams routes call.

## What This Task Proves

- ESPN really does return zero events for the implicit-default season, and 38 for
  the previous one — the bug is upstream behaviour, not a parsing mistake.
- The fallback fires only when the current season is empty, and never more than
  once.
- Two empty seasons resolve to `[]` rather than throwing, preserving the graceful
  degradation both Teams routes depend on.
- A genuine HTTP failure still throws, so an outage is reported rather than
  silently read as "no matches".
- Scores from the team-schedule endpoint now parse (see the third-defect note
  below).

## Evidence Summary

- Live ESPN requests confirm 0 events by default vs 38 with `season=2025`.
- 45 tests pass in `lib/espn/client.test.ts`, 9 of them new.
- Mutation testing confirms the new tests fail when the behaviour they describe is
  removed — they are not vacuous.
- Full suite: 470/470 passing. Typecheck and format clean.

## Artifact: Live ESPN season behaviour

**What it proves:** The empty Teams screen originates in ESPN's implicit season
resolution, and the previous season holds the data users expect to see.

**Why it matters:** This is the observation the whole fix is built on. Without it,
the fallback would be a guess.

**Commands:**

```bash
curl -s "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule" | jq '.events | length'
curl -s "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule?season=2026" | jq '.events | length'
curl -s "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule?season=2025" | jq '.events | length'
```

**Result summary:** Both the implicit default and an explicit `season=2026`
return zero events. `season=2025` returns the complete 38-fixture 2025-26
Premier League season. Captured 2026-08-05 for Liverpool (ESPN team `364`).

```text
default (no season param):        0
season=2026 (explicit current):   0
season=2025:                     38
```

## Artifact: Season-resolution test suite

**What it proves:** Each clause of Spec Unit 1 — explicit season, fallback only
on empty, at most one retry, empty-not-throw, HTTP errors still throw, explicit
season pins.

**Why it matters:** This is the regression guard. The bug is seasonal, so without
tests it would reappear next offseason with nobody watching.

**Command:**

```bash
pnpm test:ci lib/espn/client.test.ts
```

**Result summary:** 45 tests pass, including the 9 new cases. The clock is pinned
with `vi.setSystemTime("2026-08-05")` so the derived season is deterministic
rather than a function of the year the suite runs in.

```text
 ✓ lib/espn/client.test.ts (45 tests) 22ms

 Test Files  1 passed (1)
      Tests  45 passed (45)
```

New cases:

```text
✓ team schedule URL appends the season when one is given
✓ derives the current season from the clock
✓ falls back to the previous season when the current season is empty
✓ issues exactly two requests when falling back
✓ issues no fallback request when the current season is populated
✓ resolves to an empty array (does not throw) when both seasons are empty
✓ honors an explicit season and skips the fallback entirely
✓ still throws on an upstream HTTP failure rather than reading it as 'no matches'
✓ parses object-shaped scores from the team schedule endpoint
```

## Artifact: Mutation check — the tests are not vacuous

**What it proves:** The new tests actually detect the absence of the behaviours
they claim to cover.

**Why it matters:** A passing suite is worthless if it would also pass against the
broken code. This is the specific failure mode the planning audit flagged for
Task 2.9, applied here pre-emptively.

**Method:** Two deliberate mutations, each reverted immediately after measuring.

**Result summary:** Removing object-score handling fails exactly the score test.
Removing the previous-season retry fails four tests. The restored implementation
is green again.

```text
--- MUTATION 1: parseScore object handling removed
 × parses object-shaped scores from the team schedule endpoint
      Tests  1 failed | 44 passed (45)

--- MUTATION 2: previous-season retry removed
      Tests  4 failed | 41 passed (45)

--- RESTORED
      Tests  45 passed (45)
```

## Artifact: Third defect found and fixed — object-shaped scores

**What it proves:** Completed matches sourced from a team schedule were silently
losing their scores, independent of the season bug.

**Why it matters:** This was not in the spec. It was found while recording
fixtures, and it would have blocked this spec's headline deliverable: score cards
with no scores in them. The Teams screen has almost certainly been dropping
scores for as long as it has existed.

**Evidence:** The two ESPN endpoints disagree about the score shape.

```text
scoreboard endpoint     → "score": "2"                              (string)
team-schedule endpoint  → "score": { "value": 2, "displayValue": "2" }  (object)
```

`parseScore` accepted only `string | undefined`, so `Number({…})` produced `NaN`
and the function returned `undefined` for every completed team-schedule match.

**Result summary:** `parseScore` now normalizes both shapes, preferring numeric
`value` and falling back to `displayValue`. `RawScore` was introduced to type the
union. Covered by the "parses object-shaped scores" test above, which
mutation-testing confirms is load-bearing.

## Artifact: Repository quality gates

**What it proves:** The change satisfies the gates CI enforces.

**Why it matters:** `.github/workflows/ci.yml` runs these on every PR; a change
that cannot pass them cannot merge.

**Commands:**

```bash
pnpm typecheck && pnpm format:check && pnpm test:ci
```

**Result summary:** Typecheck clean, formatting clean, 470/470 tests pass across
46 files.

```text
$ tsc --noEmit
(no output)

$ prettier --check .
All matched files use Prettier code style!

 Test Files  46 passed (46)
      Tests  470 passed (470)
```

## Known pre-existing failures (not introduced by this task)

Two gate failures exist on this repo independently of Spec 13. Both were
confirmed by stashing this task's changes and re-running against the baseline
commit `63a6033`.

| Gate | Status | Verdict |
| --- | --- | --- |
| `pnpm lint` | 1 error, 2 warnings | **Pre-existing.** Identical output on baseline. `components/home-client.tsx:401` uses an `<a>` to navigate to `/teams/` where `next/link` is required. Unrelated to this spec; not fixed here to keep the commit scoped. |
| `db/smoke.test.ts` | intermittent timeout | **Flaky, not caused by this task.** Passed 3/3 on re-run. It opens a live Neon connection against a 5 s timeout; this task touches only `lib/espn/`. |

The lint error means `pnpm lint` currently fails on `main`, so CI is red before
this branch. Worth addressing separately.

## Reviewer Conclusion

The empty Teams screen is explained by verified upstream behaviour and fixed at
the shared helper, so both Teams routes inherit it. The fallback is bounded,
degrades gracefully, and still surfaces real outages. Mutation testing shows the
regression guard is real. A third, unspecified defect — silently dropped scores
from the team-schedule endpoint — was found and fixed here because it would
otherwise have made the redesigned score cards render without scores.
