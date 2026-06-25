# Catalog counts — Spec 04 Task 2.0

Refreshed via `pnpm tsx scripts/refresh-espn-catalog.ts`.

## Per-league baseball team counts (as observed)

| League key | Sport | Teams |
| --- | --- | --- |
| `baseball/mlb` | Baseball | 30 |
| `baseball/college-baseball` | Baseball | 437 |
| **Total Baseball** | | **467** |

## Whole-catalog totals

- Total teams across all 21 leagues: **2142**
- Sports present: `["American Football", "Baseball", "Basketball", "Soccer"]`
- League count: **21** (= 2 American Football + 3 Basketball + 14 Soccer + 2 Baseball)

## Verification commands

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

## Refresh script output (tail)

```
  ✓ baseball/mlb: 30 teams
  ✓ baseball/college-baseball: 437 teams
[refresh-espn-catalog] wrote /Users/rprugh/repos/score-mate/lib/espn/catalog.json: 2142 teams across 21 leagues (errors: 0).
```
