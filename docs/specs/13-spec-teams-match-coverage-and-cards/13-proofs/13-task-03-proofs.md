# Task 03 Proofs — Full-`Match` contract for `GET /api/teams`

## Task Summary

`TeamEntity.lastMatch` / `nextMatch` carried a lightweight `EntityMatch` summary
— opponent name, a `"2-1"` string, a W/L letter — built from the followed team's
perspective. That is enough for a text row and not enough for a score card,
which needs both sides' names, crests, and numeric scores.

This task changes the contract to full `Match` objects, swaps the player path to
`athleteMatchHistory` (which already returns them), and removes the code that
existed only to produce the old shape.

## What This Task Proves

- `/api/teams` returns card-ready `Match` objects for both team and player
  favorites.
- The team and player paths now produce the same shape, so one component renders
  both.
- Graceful degradation survived: a player ESPN has no data for still yields null
  matches without flipping `source.ok`; only a thrown error does that.
- The auth gate and `Server-Timing` instrumentation are untouched.
- The dead code is actually gone, not merely unreferenced.

## Evidence Summary

- 503/503 tests pass across 48 files, up from 500.
- `EntityMatch`, `extractEntityMatches`, `athleteSchedule`, and three private
  helpers orphaned by the deletion are all removed.
- Mutation testing confirms the new player-path assertions are load-bearing.
- Typecheck and format clean; lint back to the 3 pre-existing problems.

## Artifact: The response shape is card-ready

**What it proves:** `lastMatch` carries both sides, numeric scores, logos, and
the competition name.

**Why it matters:** This is the precondition for Task 4.0. If the envelope were
still one-sided, the redesigned card would have nothing to render on the
opponent's half.

**Command:**

```bash
pnpm test:ci app/api/teams/route.test.ts
```

**Result summary:** 12 tests pass. The team case asserts the full shape; the
player case asserts parity.

```text
✓ returns lastMatch (with score) and nextMatch (with kickoff) for a team favorite
✓ returns full Match objects for a player favorite via athleteMatchHistory
✓ takes only the first match per side from the athlete history
✓ uses the player's stored leagueKey metadata when present (e.g. soccer/usa.1)
✓ returns null matches without flipping source.ok when ESPN has no data for the player
✓ returns a null-match player entity and source.ok=false when the athlete lookup throws
✓ returns 401 when there is no session
✓ includes a Server-Timing header on a successful response

 Tests  12 passed (12)
```

The team-path assertion, showing the shape change concretely:

```ts
expect(entity.lastMatch).toMatchObject({
  id: "final-1",
  status: "final",
  homeTeamName: "Arsenal",
  awayTeamName: "Chelsea",
  homeScore: 2,
  awayScore: 1,
  leagueName: "English Premier League",
});
```

Previously this read `{ opponentName: "Chelsea", score: "2-1" }` — the opponent
only, and the score as a pre-formatted string from Arsenal's point of view.

## Artifact: Dead code removed, not just unreferenced

**What it proves:** Nothing that existed solely to build the old shape survives.

**Why it matters:** Sub-task 3.5 called for removal rather than orphaning. A
dead export invites a future caller to resurrect the old contract.

**Command:**

```bash
grep -rnE "\bEntityMatch\b" app components lib --include='*.ts' --include='*.tsx'
grep -rnE "export (async )?function athleteSchedule|athleteSchedule\(" app components lib scripts
```

**Result summary:** Both return nothing — no declaration and no call site.
`EntityMatchesEnvelope` is a different, still-live type for the detail route and
is deliberately retained; the `\b` word boundary excludes it.

```text
EntityMatch:     no matches
athleteSchedule: no declaration, no call sites
```

> **Corrected during validation.** This section originally used
> `grep -rn "athleteSchedule\b" … | grep -v athleteMatchHistory`. That pipeline
> is unsound: it discards any line mentioning both names, so a surviving call
> site sitting next to an `athleteMatchHistory` reference would have been
> filtered out and reported as "gone". The conclusion was correct — validation
> re-checked with the declaration/call-site pattern above and confirmed the
> export and every call site are removed — but the original evidence did not
> establish it. Validation also removed a now-stale comment in
> `app/api/teams/route.ts` that named `athleteSchedule`, a function that no
> longer exists.

Removed in full:

| Symbol | Location | Why it went |
| --- | --- | --- |
| `EntityMatch` | `lib/teams/types.ts` | The reduced summary type itself. |
| `extractEntityMatches` | `app/api/teams/route.ts` | Built `EntityMatch` from a schedule; replaced by `selectLastAndNext`. |
| `athleteSchedule` | `lib/espn/client.ts` | Returned `EntityMatch`; `athleteMatchHistory` supersedes it with strictly better coverage (5 test cases vs 3, same scenarios plus empty-eventlog and unsupported-sport). |
| `opponentFromCoreEvent` | `lib/espn/client.ts` | Private helper used only by `athleteSchedule`. |
| `ResolvedMatch` | `lib/espn/client.ts` | Ditto. |
| `tennisSetScore` | `lib/espn/client.ts` | Ditto. |

The last three were surfaced by `pnpm lint`, which flagged them as unused once
`athleteSchedule` went. Lint is back to the 3 pre-existing problems documented in
`13-task-01-proofs.md`.

## Artifact: Mutation check — the player-path tests are load-bearing

**What it proves:** The rewritten player assertions fail when the swap is broken.

**Why it matters:** Three player tests were rewritten wholesale in this task.
Rewritten tests are exactly where a silently-vacuous assertion hides.

**Method:** Force the player branch to return null matches, run, revert.

**Result summary:** 2 of 12 tests fail under the mutation; all 12 pass reverted.

```text
--- MUTATION: player path returns null matches
      Tests  2 failed | 10 passed (12)

--- RESTORED
      Tests  12 passed (12)
```

## Artifact: Repository quality gates

**Command:**

```bash
pnpm typecheck && pnpm format:check && pnpm test:ci
```

**Result summary:** Clean, clean, and 503/503 across 48 files.

```text
$ tsc --noEmit
(no output)

$ prettier --check .
All matched files use Prettier code style!

 Test Files  48 passed (48)
      Tests  503 passed (503)
```

## Resequencing note: `EntityCard` was rewritten here, not in Task 4.0

The plan put the `EntityCard` rewrite in Task 4.0 (sub-tasks 4.3–4.5). It had to
move here, because changing `TeamEntity` to `Match` breaks the component's
compile immediately — `pnpm typecheck` cannot pass with the old card in place,
and the parent-task checklist requires it to.

The alternative was a throwaway adaptation: re-implementing `extractEntityMatches`
inside the component to keep the old rows working for exactly one commit. That
would have meant writing code whose only purpose was to be deleted in the next
task.

So Task 3.0 absorbed:

- 4.3 — the header + stacked-slots rewrite of `EntityCard`
- 4.4 — extracting `EntityMatchCard` into a shared module, now imported by both
  the Teams list and the detail screen instead of being duplicated
- 4.5 — the preserved empty states, plus "Last"/"Next" slot labels
- 4.8 — the `entity-card.test.tsx` rewrite (13 cases)

Task 4.0 retains the competition-name footer fallback, the single-column layout
change, the `teams-client.test.tsx` breakpoint guard, and the screenshots. The
task file records this split.

Two incidental fixes while rewriting the card tests, both mine rather than the
component's:

- `"Leeds United"` does not end with its short name `"Leeds"`, so `splitTeamName`
  renders the full name unsplit. My first assertion expected `"Leeds"`.
- `TennisMatchCard` and `MatchCard` share the `match-card` testid, so it cannot
  discriminate between them. The tests now key on `match-center`, the fixed-width
  score column only `MatchCard` renders.

## Reviewer Conclusion

`/api/teams` now speaks the same language as Home and the detail screen: full
`Match` objects for teams and players alike. The old summary type and everything
that fed it are gone, verified by grep and by lint catching the helpers the
deletion orphaned. The contract change is the enabling step for the visible
redesign, and the mutation check shows the tests guarding it would notice if it
regressed.
