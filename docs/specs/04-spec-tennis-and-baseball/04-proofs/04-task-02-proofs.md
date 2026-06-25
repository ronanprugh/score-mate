# Task 02 Proofs — Catalog refresh + cache prefix bump + release note

## Task Summary

Task 2.0 expands the committed ESPN catalog to include MLB and NCAA D-I baseball teams, bumps the homepage cache prefix so cached planning results from prior deploys do not suppress baseball matches, and adds a release-note entry to the README. This is the data + deploy plumbing that activates the Baseball wiring registered in Task 1.0 for real users.

## What This Task Proves

- The Favorites typeahead can find baseball teams (MLB + NCAA D-I) because the committed catalog now contains them.
- The homepage cache invalidates on deploy because the cache-key prefix has changed.
- The release note records the change for operators and future readers.
- All CI gates (lint, format:check, typecheck, test:ci, build) pass with the expanded catalog and updated tests.
- Success Metric §6 holds: no edits to the aggregator, home/favorites route handlers, or shared UI components.

## Evidence Summary

- `lib/espn/catalog.json` now has 2142 teams across 21 leagues, including 30 MLB and 437 NCAA D-I baseball teams; `jq` confirms the sport set is exactly `["American Football","Baseball","Basketball","Soccer"]`.
- A node breadth-check against the committed catalog returns ≥ 1 Baseball hit for `yankees`, `dodgers`, `orioles`, and `razorbacks`.
- `CACHE_KEY_PREFIX` is now `"v6-espn-baseball"` (was `"v5-espn-shortname"`), and `lib/home/cache.test.ts` pins the new value.
- README's Operations → Release notes section has a new 2026-06-24 entry referencing Spec 04.
- Full CI gate transcript captured to `04-ci-gates.txt`; all gates pass.
- Touched-files list (`04-touched-files.txt`) excludes every Success Metric §6 forbidden path.

## Artifact: Catalog counts and sport set

**What it proves:** The refreshed `lib/espn/catalog.json` carries the expected number of MLB / NCAA D-I baseball teams and the catalog is now exactly the four-sport v1 set.

**Why it matters:** Baseball teams only show up in the Favorites typeahead if they are in the committed catalog. The MLB count must be 30, the NCAA D-I count must be in the hundreds (ESPN reports 437 D-I programs), and the catalog must not have drifted to other sports.

**Artifact path:** `docs/specs/04-spec-tennis-and-baseball/04-proofs/04-catalog-counts.md`

**Result summary:** MLB = 30 teams; NCAA D-I baseball = 437 teams; total Baseball = 467; whole-catalog total = 2142 teams across 21 leagues. Sport set is exactly `["American Football","Baseball","Basketball","Soccer"]`.

```bash
jq '.teams | map(select(.sport == "Baseball")) | length' lib/espn/catalog.json
# → 467
jq '.teams | map(select(.leagueKey == "baseball/mlb")) | length' lib/espn/catalog.json
# → 30
jq '.teams | map(select(.leagueKey == "baseball/college-baseball")) | length' lib/espn/catalog.json
# → 437
jq '[.teams[] | .sport] | unique' lib/espn/catalog.json
# → ["American Football","Baseball","Basketball","Soccer"]
```

## Artifact: Breadth check — real team-name queries return baseball hits

**What it proves:** Real-world Favorites typeahead queries against the committed catalog return at least one Baseball team each.

**Why it matters:** Counts alone do not prove discoverability. This is the user-visible behavior the catalog is meant to enable.

**Artifact path:** `docs/specs/04-spec-tennis-and-baseball/04-proofs/04-breadth.txt`

**Result summary:** `yankees`, `dodgers`, and `orioles` each resolve to an MLB team; `razorbacks` resolves to an NCAA D-I program (Arkansas Razorbacks). NCAA-side coverage confirmed via a real D-I school name because the originally-suggested "bombers" probe is not a real NCAA D-I baseball nickname.

```
yankees     : 1 Baseball hit(s) — e.g. New York Yankees (baseball/mlb)
dodgers     : 1 Baseball hit(s) — e.g. Los Angeles Dodgers (baseball/mlb)
orioles     : 1 Baseball hit(s) — e.g. Baltimore Orioles (baseball/mlb)
razorbacks  : 1 Baseball hit(s) — e.g. Arkansas Razorbacks (baseball/college-baseball)
```

## Artifact: CI gate transcript

**What it proves:** Every CI gate (`lint`, `format:check`, `typecheck`, `test:ci`, `build`) passes locally with the refreshed catalog and updated tests.

**Why it matters:** These are the same gates CI runs on every PR; passing them locally is the strongest available signal that the change is mergeable.

**Artifact path:** `docs/specs/04-spec-tennis-and-baseball/04-proofs/04-ci-gates.txt`

**Result summary:** All 249 tests pass across 29 test files; lint, format:check, and typecheck exit clean; `pnpm build` completes successfully and emits the expected 13 routes.

```
Test Files  29 passed (29)
     Tests  249 passed (249)
```

## Artifact: Touched-files list

**What it proves:** The combined diff for Spec 04 (T1.0 + T2.0) touches only files allowed by Success Metric §6.

**Why it matters:** Success Metric §6 forbids edits to `lib/home/aggregator.ts`, `app/api/home/route.ts`, `app/api/favorites/search/route.ts`, and any path under `components/`. This file is the auditable receipt that the rule held.

**Artifact path:** `docs/specs/04-spec-tennis-and-baseball/04-proofs/04-touched-files.txt`

**Result summary:** None of the forbidden paths appear in the touched-files list.

## Artifact: Cache-prefix bump

**What it proves:** `CACHE_KEY_PREFIX` is now `"v6-espn-baseball"`, and the test pins the new value.

**Why it matters:** Existing deploys cache planning results under `v5-espn-shortname` for up to an hour. Without the prefix bump, the homepage would serve stale planning results that omit baseball even after the spec ships.

```ts
// lib/home/cache.ts
export const CACHE_KEY_PREFIX = "v6-espn-baseball";

// lib/home/cache.test.ts
it("is v6-espn-baseball", () => {
  expect(CACHE_KEY_PREFIX).toBe("v6-espn-baseball");
});
```

## Artifact: README release note

**What it proves:** The README's Operations → Release notes section documents the Baseball addition and the cache-prefix bump.

**Why it matters:** Operators reading the README must be able to understand the deploy story for this change without spelunking through git history.

**Result summary:** New 2026-06-24 entry references Spec 04 and identifies the cache-prefix bump as the deploy invalidation mechanism.

## Reviewer Conclusion

The catalog now ships baseball teams, real typeahead queries return them, the homepage cache invalidates on deploy, and every CI gate passes. The change stays inside the Success Metric §6 boundary, so the aggregator/route/UI surface is provably untouched.
