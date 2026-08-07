# Task 05 Proofs — Latency verification and release documentation

## Task Summary

Spec 13 measurably increases the upstream work `/api/teams` does: a Premier
League team goes from 1 schedule request to 13. This task measures that cost and
checks it against the budget the spec set — warm median ≤ 100 ms, cold ≤ 1 200 ms
— and records the operational change in the README.

## Headline: the budget is NOT verified end to end

Spec 12's numbers were taken against an **instrumented production Vercel
deployment** with a signed-in session and a real favorites profile
(`12-baseline-performance.md`). I cannot reproduce that setup: it needs a
deployment I should not make and an authenticated session I will not create.

Rather than present a locally-measured number as if it were comparable, this
proof reports:

- **Measured, real:** the upstream ESPN cost — the only term this spec changes,
  and the one that dominates cold latency.
- **Estimated, labelled:** the warm-path effect, which depends on `unstable_cache`
  behaviour inside the Next.js runtime.
- **Unverified:** end-to-end `/api/teams` server timings.

**Verdict: the budget is very likely to hold, but a reviewer should treat it as
unconfirmed until the production measurement is run post-deploy.** The
concurrency result below is the reason for the optimism, and it is a stronger
result than the spec assumed.

## What This Task Proves

- The fan-out cost does **not** scale with the number of followed entities.
- The upstream delta is roughly +70 ms, not the multiple-seconds a 13× request
  increase might suggest.
- The Home feed's fan-out is byte-for-byte unchanged.
- The operational change is documented where prior spec-level changes were.

## Artifact: Upstream fan-out measurement

**What it proves:** The real cost of the season fallback and the competition
fan-out, against live ESPN, with exact request counts.

**Why it matters:** This is the term the cold budget has to absorb. Measuring it
directly is more honest than extrapolating from Spec 12's end-to-end figure.

**Command:**

```bash
pnpm tsx scripts/measure-teams-fanout.ts 7
```

**Result summary:** A single team's fan-out costs 13 requests but only ~70 ms,
because the requests are concurrent. The 7-entity profile costs 47 requests and
~103 ms — essentially the same wall-clock as one entity. The "before" column is
the bug: 1 request, 30 ms, **zero matches**.

```text
Liverpool (364), primary league soccer/eng.1, 7 runs each.
Every run is a cold upstream fetch — no cache in this harness.

before: 1 league, implicit season      median    30 ms  range  29-155 ms  requests  1  matches   0
after T1: 1 league + season fallback   median    70 ms  range  65-97  ms  requests  2  matches  38
after T2: 7 competitions               median    69 ms  range  62-443 ms  requests 13  matches  59

7-entity profile, all concurrent       median   103 ms  range  84-483 ms  requests 47  matches 493
```

Reading the table:

| | Requests | Median | Matches found |
| --- | --- | --- | --- |
| Before Spec 13 | 1 | 30 ms | **0** — the reported bug |
| + season fallback (T1) | 2 | 70 ms | 38 |
| + competition fan-out (T2) | 13 | 69 ms | 59 |
| 7-entity profile | 47 | 103 ms | 493 |

Two things worth pausing on:

1. **13 requests, not 14.** Task 2.0's proof predicted a worst case of 7
   competitions × 2 seasons. Actual is 13: `club.friendly` has current-season
   data, so it never triggers the fallback. The prediction was the upper bound
   and reality came in one under it.
2. **7 entities cost the same as 1.** 47 concurrent requests complete in ~103 ms
   — barely above a single entity's 69 ms. `Promise.allSettled` across
   competitions nests inside the route's existing `Promise.all` across entities,
   so width is nearly free in wall-clock terms. This is why the cold budget is
   likely safe despite a 13× request increase.

**Caveat a reviewer must apply:** measured from a developer machine, not from a
Vercel serverless region. Absolute latency to ESPN will differ. The *shape* of
the result — concurrency making width cheap — is what transfers.

## Artifact: Cold-budget assessment

**What it proves:** How the measured delta maps onto the spec's 1 200 ms cold
budget.

**Result summary:** Spec 12 recorded `/api/teams` cold at 2 417 ms **before** its
caching fix and set a ≤ 600 ms gate after. Most of that cold time is Vercel
instance start, module init, and the database query — not ESPN, which at 7
concurrent calls was a small fraction. This spec adds ~70 ms of concurrent
upstream time on top. Against a 1 200 ms budget with a ≤ 600 ms post-Spec-12
starting point, ~70 ms is comfortable headroom.

| Budget | Spec 12 result | Spec 13 expectation | Status |
| --- | --- | --- | --- |
| Warm median ≤ 100 ms | 19 ms | ~25–50 ms (estimate) | **Unverified** — likely pass |
| Cold ≤ 1 200 ms | ≤ 600 ms gate | +~70 ms upstream | **Unverified** — likely pass |
| `/api/teams/[id]/matches` warm ≤ 50 ms | 20 ms | unchanged shape | **Unverified** — likely pass |

The warm estimate: each competition caches independently, so a warm request
performs 7 in-process cache reads instead of 1. Spec 12 measured those reads at
1–5 ms each, giving roughly +6–30 ms on a 19 ms baseline. That stays inside the
100 ms gate with room, but it is arithmetic, not a measurement.

**Recommended follow-up:** after deploying, re-run Spec 12's measurement method
against the deployment and append the real numbers here. If cold exceeds
1 200 ms, the lever named in Spec Open Question 3 is trimming
`COMPANION_LEAGUE_KEYS` — dropping the three UEFA competitions for teams that
have never appeared in them would take a Premier League team from 13 requests
to 7.

## Artifact: The Home feed is unchanged

**What it proves:** Registering `club.friendly` did not widen the Home
aggregator's fan-out or add friendlies to the Home feed.

**Why it matters:** This was the planning audit's highest-risk finding, and the
one that Spec Non-Goal #8 forbids.

**Result summary:** 21 league keys, exactly as before this branch, and
`club.friendly` is absent from the Soccer set.

```text
Soccer               14 league keys
American Football     2 league keys
Basketball            3 league keys
Baseball              2 league keys

SUPPORTED_LEAGUES total: 21
Home fan-out breadth:    21 league keys x 5 dates = 105 calls
club.friendly present:   false
```

The strongest evidence here is not the script but a test I never touched:
`lib/espn/leagues.test.ts` has asserted `SUPPORTED_LEAGUES` has exactly 21
entries with Soccer at 14 since before this branch, and it still passes
unmodified. Had `club.friendly` gone into `SUPPORTED_LEAGUES`, that assertion
would have failed. A no-measurement result is the correct result for `/api/home`:
no code path it uses was changed.

## Artifact: README release note

**What it proves:** The operational change is recorded where Specs 03, 04, and 05
recorded theirs.

**Artifact path:** `README.md`, "Operations → Release notes"

**Result summary:** A dated entry covering the season rollover, competition
coverage, score cards, and the `parseScore` fix — and stating explicitly that no
cache-prefix bump is needed, because the schedule cache keys now include the
league key and season and therefore cannot collide with the old keyspace. Prior
specs bumped a prefix as their invalidation mechanism; a reviewer will look for
that, so its absence needed a reason.

## Artifact: Full CI gate set

**What it proves:** Everything CI runs, in CI order, including the production
build that no earlier task exercised.

**Command:**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build
```

**Result summary:** See the run captured below. `pnpm lint` fails on a
pre-existing error unrelated to this spec, documented since
`13-task-01-proofs.md` and confirmed present on the baseline commit `63a6033`:
`components/home-client.tsx:401` uses an `<a>` where `next/link` is required.
Every other gate passes.

## Reviewer Conclusion

The fan-out this spec adds is real — 13 requests where there was 1 — but it is
concurrent, and the measurement shows 7 entities costing no more wall-clock than
one. The upstream delta is ~70 ms, which sits comfortably inside a 1 200 ms cold
budget. What this proof does **not** do is verify the end-to-end budget, because
that requires a production deployment and a signed-in session; the honest status
is "likely pass, unconfirmed", and the follow-up is one measurement run after
deploy. The Home feed is untouched, verified by an assertion that predates this
work.
