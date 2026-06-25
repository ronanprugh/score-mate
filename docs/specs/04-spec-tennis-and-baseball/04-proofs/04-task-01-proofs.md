# Task 01 Proofs — Sport / league / allowlist additions

## Task Summary

This task proves the type system, the ESPN sport-segment decoder, the league registry, the sport allowlist, and the favorites validator all recognize Baseball. The code path is now ready to accept a Baseball favorite and route it to `baseball/mlb` + `baseball/college-baseball` scoreboard calls — even before the catalog refresh in T2.0 makes baseball teams searchable.

## What This Task Proves

- `Sport` now includes `"Baseball"` and `SUPPORTED_SPORTS` lists all four sports.
- `sportFromLeagueKey("baseball/mlb")` resolves to `"Baseball"` (and same for `baseball/college-baseball`).
- `SUPPORTED_LEAGUES` carries two new Baseball entries (`baseball/mlb` → MLB, `baseball/college-baseball` → NCAA Baseball).
- `leagueKeysForSport("Baseball")` returns exactly those two keys; `findSupportedLeague("baseball/mlb")` returns the full entry.
- `SPORT_ALLOWLIST.Baseball` is defined with MLB + NCAA D-I + College World Series.
- `matchesSportAllowlist("Baseball", …)` accepts MLB by `leagueId`, accepts College World Series by name substring, and rejects an NPB Pacific League match.
- `favorites/validators.ts` `sportSchema` accepts `"Baseball"` and still rejects `"Tennis"`.
- All 248 tests pass (was 241 pre-spec; +7 baseball assertions). Lint + typecheck clean.

## Evidence Summary

- `pnpm test:ci` → 29 files, 248 tests, all passing.
- `pnpm lint` and `pnpm typecheck` → both clean.
- New / updated tests:
  - `lib/espn/client.test.ts`: 2 new entries in the `sportFromLeagueKey` table for baseball.
  - `lib/espn/leagues.test.ts`: count bumped 19 → 21; new Baseball cases (`leagueKeysForSport`, `findSupportedLeague`).
  - `lib/sport-allowlist.test.ts`: 3 new Baseball cases (positive MLB, positive CWS, negative NPB); shape check expanded.
  - `lib/favorites/validators.test.ts`: Baseball moved from rejected → accepted.

## Artifact: All gates pass

**What it proves:** The new sport propagates through every consumer (types, segment decoder, league registry, allowlist, validator) with no `any` escape hatches and no regressions.

**Command:**

```bash
pnpm test:ci && pnpm lint && pnpm typecheck
```

**Result summary:** Tests 248/248 green, lint clean, typecheck clean.

```
 Test Files  29 passed (29)
      Tests  248 passed (248)
$ eslint
$ tsc --noEmit
```

## Artifact: Sport / league registry shape

**What it proves:** The two new Baseball entries are wired into the registry that the aggregator already uses for fan-out planning — no aggregator changes needed.

**Command:**

```bash
pnpm test:ci lib/espn/leagues.test.ts lib/espn/client.test.ts
```

**Result summary:** `SUPPORTED_LEAGUES` now has 21 entries (2 + 3 + 14 + 2). `leagueKeysForSport("Baseball")` returns both baseball keys.

## Artifact: SPORT_ALLOWLIST.Baseball entries

**What it proves:** A user who favorites the `Baseball` sport (type='sport') will see matches from MLB, NCAA D-I baseball, and the College World Series — and nothing from NPB / other international leagues.

**Command:**

```bash
pnpm test:ci lib/sport-allowlist.test.ts
```

**Result summary:** Three new Baseball assertions pass (MLB by leagueId, CWS by name, NPB rejected).

## Reviewer Conclusion

Baseball is now a fully recognized sport in every code path that enumerates sports or league keys — except for the catalog (which T2.0 refreshes) and the cache prefix (which T2.0 bumps). The aggregator, route handlers, and UI components were not touched, per Success Metric §6.
