# Task 03 Proofs — TournamentCard + MatchCard player-vs-player + homepage mixed-feed sort

## Task Summary

This task delivers the visible Tennis surface on the homepage. `TournamentCard` renders a collapsed row (name, date range, round, counts) that expands to show `MatchCard` rows. `MatchCard` gains a player-vs-player mode that skips logo placeholders and uses full athlete display names. The homepage merges match cards and tournament cards into a single sorted feed using the "earliest live/upcoming kickoff" sort key from `sortKeyForTournamentCard`.

## What This Task Proves

- `TournamentCard` collapsed state shows `displayName`, formatted date range, `currentRound`, and count line.
- Clicking the chevron toggles to expanded state showing one `MatchCard` per match.
- Two independent `TournamentCard` instances can expand/collapse independently.
- The collapsed row root meets `min-h-11` (≥44px tap target).
- `MatchCard` in player-vs-player mode renders full names verbatim with no logo placeholder div.
- `HomeClient` sorts tournament cards into the mixed feed at the slot of their earliest live/upcoming match.
- When `activeTennisTournaments` is `[]`, no `TournamentCard` is rendered.
- `sortKeyForTournamentCard` falls back to the sentinel `"9999-12-31T23:59:59"` for tournaments with no live/upcoming matches.

## Evidence Summary

- `components/tournament-card.test.tsx`: 6 tests cover all collapsed/expanded/tap-target/independence behaviors.
- `components/match-card.test.tsx`: new player-vs-player test asserts full names, no logo placeholder.
- `components/home-client.test.tsx`: 2 new tests (T3.8a, T3.8b) cover sort-slot placement and empty array case.
- `lib/home/aggregator.test.ts`: `sortKeyForTournamentCard` tested for live/upcoming min and fallback sentinel.
- `pnpm typecheck` exits 0.
- `pnpm test:ci`: 296 tests pass.

## Artifact: tournament-card.test.tsx

**What it proves:** The TournamentCard component behaves correctly in all four scenarios: collapsed rendering, expand toggle, independent multi-card state, and tap-target compliance.

**Why it matters:** This is the primary UX component introduced by Spec 05. Any regression here would mean users see wrong data or can't expand/collapse.

**Result summary:**

```
components/tournament-card.test.tsx — 6 tests passed  ✓
```

Tests include:
- Collapsed state shows displayName, formatted date range, currentRound, and counts line ✓
- Chevron click toggles to expanded, showing `data-testid="match-card"` for each match ✓
- Two cards expand independently (opening one doesn't close or affect the other) ✓
- Collapsed row root has `min-h-11` class (≥44px tap target) ✓

## Artifact: match-card.test.tsx — player-vs-player

**What it proves:** When both team logos are absent, `MatchCard` renders full athlete names with no logo placeholder div and no prefix/mascot split.

**Why it matters:** Without this mode, tennis match names would be truncated or mis-split by `splitTeamName`, rendering "Carlos" / "Alcaraz" as prefix/mascot instead of the full name.

**Result summary:**

```
components/match-card.test.tsx — 9 tests passed  ✓ (previously 8, +1 new)
```

New test:
- `MatchCard > player-vs-player: renders full names, no logo placeholder, no prefix span` ✓
  - Both `"Carlos Alcaraz"` and `"Jannik Sinner"` present in DOM verbatim
  - No element with logo placeholder class `bg-zinc-100` in the subtree
  - No `text-xs` prefix span rendered

## Artifact: home-client.test.tsx — mixed-feed sort

**What it proves:** Tournament cards are sorted into the match-card feed at the correct position, and the empty-array case renders no cards.

**Why it matters:** Incorrect sort placement would mean a live Wimbledon card appears below yesterday's completed baseball matches instead of at the top.

**Result summary:**

```
components/home-client.test.tsx — 13 tests passed  ✓ (previously 11, +2 new)
```

New tests:
- `(T3.8a) tournament card renders between two matches at its sort-key slot` ✓
- `(T3.8b) when activeTennisTournaments is [], no TournamentCard is rendered` ✓

## Artifact: aggregator.test.ts — sortKeyForTournamentCard

**What it proves:** The sort helper returns the minimum live/upcoming kickoffUtc, or the sentinel string when none exist.

**Why it matters:** The sentinel `"9999-12-31T23:59:59"` ensures tournaments with no active matches today sort below all match cards — correct behavior for completed or not-yet-started tournaments.

**Result summary:**

```
lib/home/aggregator.test.ts — 20 tests passed  ✓
```

Relevant:
- `sortKeyForTournamentCard > returns earliest live/upcoming kickoffUtc as the sort key` ✓
- `sortKeyForTournamentCard > falls back to sentinel when no live/upcoming matches — sorts below all match cards` ✓

## Reviewer Conclusion

The full Tennis UI surface works end-to-end: `TournamentCard` renders correctly in both states, meets tap-target requirements, and the homepage correctly slots it into the mixed feed. `MatchCard` handles player-vs-player cleanly. All 296 tests pass with no regressions.
