# Task 05 Proofs — End-to-end verification + residue sweep

## Task Summary

This task proves the full CI gate suite is green against the merged spec; every Success Metric that can be evidenced without an authenticated browser session is captured; the two audit FLAG findings are empirically resolved with measured numbers (not just narrative); and the proof bundle is indexed for the validation phase. The two remaining artifacts that require a live user session — a homepage screenshot and a live-game freshness observation — are deferred to user verification with an exact reproduction recipe.

## What This Task Proves

- All five CI gates (`lint`, `format:check`, `typecheck`, `test:ci`, `build`) pass against the head of this branch.
- Zero `thesportsdb` / `lib/sportsdb` references remain anywhere in `.ts`, `.tsx`, or `.json` outside `docs/` (Success Metric §1).
- All 8 Success Metric §4 breadth queries return ≥ 1 result from the committed catalog.
- The 14-league soccer fan-out completes in 291ms cold and p50 = 83ms warm — an order of magnitude faster than the audit's 5s threshold (Audit FLAG §2 resolved with no follow-up needed).
- The cold-cache scenario (Audit FLAG §1) was measured directly: a fresh process making 70 ESPN scoreboard calls in parallel completes in 291ms.
- The proof bundle is indexed and mapped to every spec FR / Success Metric / audit finding.

## Evidence Summary

| Check | Result | Artifact |
| --- | --- | --- |
| Lint | ✅ | [05-ci-gates.txt](./05-ci-gates.txt) |
| Format check | ✅ | [05-ci-gates.txt](./05-ci-gates.txt) |
| Typecheck | ✅ | [05-ci-gates.txt](./05-ci-gates.txt) |
| Test suite | ✅ 241/241 | [05-ci-gates.txt](./05-ci-gates.txt) |
| Next build | ✅ 13 routes, no warnings | [05-ci-gates.txt](./05-ci-gates.txt) |
| Residue grep | ✅ 0 hits | [05-grep-residue.txt](./05-grep-residue.txt) |
| Breadth (8 anchors) | ✅ 8/8 hit | [05-breadth.txt](./05-breadth.txt) |
| Cold-cache fan-out | 291 ms / 70 calls | [05-cold-cache.txt](./05-cold-cache.txt) |
| Soccer fan-out p50 | 83 ms (5 runs) | [05-soccer-fanout.txt](./05-soccer-fanout.txt) |

## Artifact: Full CI gate suite

**What it proves:** Every gate that runs in `.github/workflows/ci.yml` passes locally against the merged spec.

**Why it matters:** This is the same suite that gates merges to `main`; if anything is red here, the PR can't ship.

**Command:**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build
```

**Artifact path:** [05-ci-gates.txt](./05-ci-gates.txt)

**Result summary:** All five gates pass. The build emits 13 routes (5 static, 8 dynamic) with no warnings.

```
=== pnpm lint ===          (no output → pass)
=== pnpm format:check ===  All matched files use Prettier code style!
=== pnpm typecheck ===     (no output → pass)
=== pnpm test:ci ===       Test Files  29 passed (29)
                           Tests      241 passed (241)
=== pnpm build ===         ✓ Compiled successfully in 2.4s
                           ✓ Generating static pages using 7 workers (13/13)
```

## Artifact: Residue grep — zero hits

**What it proves:** Success Metric §1 — no code path still references the old provider.

**Why it matters:** Stray references would mean a half-finished swap and a maintenance hazard.

**Command:**

```bash
grep -rE "thesportsdb|lib/sportsdb" --include="*.ts" --include="*.tsx" --include="*.json" . \
  | grep -v node_modules | grep -v .next | grep -v docs/specs | grep -v pnpm-lock.yaml
```

**Artifact path:** [05-grep-residue.txt](./05-grep-residue.txt)

**Result summary:** No hits.

## Artifact: Breadth check — 8/8 anchor queries return results

**What it proves:** Success Metric §4 — the committed ESPN catalog actually covers the leagues users would search for.

**Why it matters:** A catalog full of obscure teams but missing Arsenal or the Lakers would be a regression. This is the smoke test.

**Command:** see [05-breadth.txt](./05-breadth.txt) (node one-liner against `lib/espn/catalog.json`)

**Result summary:**

```
  q='arsenal'    total=3  example='Arsenal'
  q='lakers'     total=6  example='Grand Valley State Lakers'
  q='chiefs'     total=2  example='Morningside Chiefs'
  q='manchester' total=6  example='Manchester Spartans'
  q='liverpool'  total=4  example='Liverpool'
  q='barcelona'  total=3  example='Barcelona SC'
  q='wnba'       total=1  example='WNBA'
  q='mls'        total=1  example='MLS'
```

(Note: the "first example" can be a college-football team named Lakers; the headline pro teams — LA Lakers, KC Chiefs, Arsenal, Liverpool, Manchester United, Barcelona — are all present and explicitly asserted by `app/api/favorites/search/route.test.ts`.)

## Artifact: Cold-cache observation (Audit FLAG §1)

**What it proves:** The first request after a deploy — when `unstable_cache` has been invalidated by the `v3-espn` prefix bump — still completes in well under any reasonable user-facing latency budget.

**Why it matters:** The audit flagged that a cache-prefix bump fans out 70 uncached ESPN calls for any soccer-favorite user on the very first post-deploy request. If that was multi-second, it would be a visible regression.

**Method:** A small bench script (`/tmp/bench.ts`, run via `pnpm tsx`) calls `scoreboardForLeague` for every combination of (14 soccer league keys × 5 widened dates) in parallel via `Promise.allSettled`, then measures wall-clock time. The first run has no warm CDN cache; subsequent runs benefit from ESPN's own edge caching.

**Artifact path:** [05-cold-cache.txt](./05-cold-cache.txt)

**Result summary:** Cold run = 291ms, 70/70 successful, 26 events fetched.

```
  run 1: 291 ms, 70 ok, 0 err, 26 events
  run 2:  83 ms, 70 ok, 0 err, 26 events
  ...
```

**Conclusion:** Cold fan-out is acceptable. No follow-up action required.

## Artifact: Soccer fan-out p50 (Audit FLAG §2)

**What it proves:** The 14-league soccer fan-out — the audit's largest concern — runs at p50 = 83ms across 5 consecutive requests.

**Why it matters:** The audit flagged that a Soccer-favorite user triggers `14 × 5 = 70` ESPN calls per `/api/home` invocation. If p50 exceeded 5s we agreed to open a follow-up issue to trim the league set.

**Method:** Same bench script as above. Run 1 is cold (no warm caches), runs 2–5 are warm.

**Artifact path:** [05-soccer-fanout.txt](./05-soccer-fanout.txt)

**Result summary:** `min=79ms  p50=83ms  max=291ms` across 5 runs.

**Conclusion:** p50 is far under the 5s threshold. **No follow-up issue required.** The 14-league set the user chose in Q3 (F) is empirically fine.

## Deferred to user verification

The two remaining proof artifacts require a signed-in browser session against your real user account and (for the live-game observation) a game actively in progress during the validation window. The agent cannot drive your browser session.

### T5.3 — Homepage screenshot

**Recipe:** start the dev server, sign in, favorite one team per supported sport (e.g. Arsenal, Lakers, Chiefs), then capture a screenshot of the homepage.

```bash
pnpm dev
# Open http://localhost:3000, sign in, add favorites, capture screenshot.
# Save to docs/specs/03-spec-espn-backend/03-proofs/05-homepage.png
```

### T5.4 — Live in-progress game observation (Success Metric §3)

**Recipe:** during a window with at least one live game in any of your favorites, observe a score change cycle:

1. Note the current score and timestamp on the homepage.
2. Wait 30–60 seconds (the cache TTL for today is 30s).
3. Refresh; if the upstream score changed, capture before/after screenshots with timestamps.
4. Save to `05-live-update.png` with the elapsed time annotated.

If no live game is available during the validation window, this can be deferred to a subsequent observation — Success Metric §3 is a steady-state property, not a launch blocker.

## Reviewer Conclusion

Every check the agent can run against the merged code is green. The two audit FLAG findings are empirically resolved with measured numbers (cold = 291ms, p50 = 83ms — both far under any threshold of concern). The proof bundle is indexed at [README.md](./README.md). The two remaining artifacts (`05-homepage.png`, `05-live-update.png`) require a signed-in browser session and are documented for user verification.

The spec is fully implementable from here: `/SDD-4-validate-spec-implementation` can use this bundle as its evidence source.
