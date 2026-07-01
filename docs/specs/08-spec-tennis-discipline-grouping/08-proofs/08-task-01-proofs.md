# Task 01 Proofs — Player tournament seed in the tennis data model

## Task Summary

This task adds a per-player seed to the tennis `Match` model so downstream match-priority scoring has real data to sort by. It began with a live spike against ESPN to confirm what ranking data actually exists in the tennis scoreboard payload.

## What This Task Proves

- ESPN's tennis scoreboard exposes **no world ranking** — the only ranking-like field is `competitor.curatedRank.current`, which is the player's **tournament seed** (1–32 at a Slam, present only on seeded players).
- The model now carries an optional `TennisPlayerLine.seed`, parsed from `curatedRank.current`.
- Seeded competitors yield the expected `seed`; unseeded competitors (no `curatedRank`) leave `seed` undefined — no sentinel is invented at the parse layer.
- The change is covered by a deterministic test backed by a committed sample of the real payload shape, and it does not regress the existing suite.

## Evidence Summary

- Spike against the live ATP scoreboard: `curatedRank.current` present on 157/1270 competitors, value range **1–32** (i.e. seeds, not world ranking).
- New parser test passes; full suite is green (327 tests).
- `pnpm typecheck` and `pnpm format:check` pass; `pnpm lint` reports 0 errors.

## Artifact: Spike — ESPN scoreboard ranking field

**What it proves:** The only ranking signal in the payload is the tournament seed, justifying the `seed` naming and the "unseeded → undefined" rule.

**Why it matters:** The spec originally assumed world ranking; this spike is the basis for the user decision to use the seed instead.

**Command:**

```bash
curl -s "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard" \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0));
    let vals=[],miss=0;
    for(const e of d.events||[])for(const g of e.groupings||[])for(const c of g.competitions||[])for(const comp of c.competitors||[]){
      const r=comp.curatedRank&&comp.curatedRank.current;
      r==null?miss++:vals.push(r);}
    vals.sort((a,b)=>a-b);
    console.log("with seed:",vals.length,"missing:",miss,"min:",vals[0],"max:",vals[vals.length-1]);'
```

**Result summary:** `curatedRank.current` ranges 1–32 and is present on only the seeded minority — confirming it is the tournament seed, and that no world-ranking field exists.

```
with seed: 157 missing: 1113 min: 1 max: 32
```

## Artifact: Parser test (seed present + absent)

**What it proves:** The parser reads `curatedRank.current` into `seed` and leaves it undefined for unseeded players.

**Why it matters:** This is the core behavior downstream priority scoring depends on.

**Command:**

```bash
pnpm test:ci lib/espn/tennis.test.ts
```

**Result summary:** All 21 tests pass, including the new case asserting seeds `1`/`4`/`5` are parsed and the unseeded competitor's `seed` is `undefined`.

```
✓ lib/espn/tennis.test.ts (21 tests) 46ms
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

## Artifact: Model change (diff)

**What it proves:** `TennisPlayerLine` now carries the optional `seed` field.

**Why it matters:** This is the model surface every consumer (priority scoring, UI) will read.

**Artifact path:** `lib/sports/types.ts`

**Result summary:** Added `seed?: number` with a doc comment documenting the ESPN source and the unseeded semantics.

```ts
/**
 * Tournament seed from ESPN `competitor.curatedRank.current`; lower = better.
 * Undefined when the player is unseeded (the scoreboard exposes no world
 * ranking — only this per-event seed). Consumed by tennis match-priority.
 */
seed?: number;
```

## Artifact: Full suite + gates

**What it proves:** No regression from the model/parser change.

**Why it matters:** Task 1.0 is the foundation for Tasks 2–4; it must not break existing behavior.

**Command:**

```bash
pnpm typecheck && pnpm test:ci && pnpm format:check
```

**Result summary:** Typecheck clean; 327/327 tests pass; formatting clean. `pnpm lint` reports 0 errors (2 pre-existing warnings in an unrelated script).

```
 Test Files  35 passed (35)
      Tests  327 passed (327)
```

## Reviewer Conclusion

The spike established that ESPN provides only a tournament seed (not world ranking); the model and parser now surface that seed as `TennisPlayerLine.seed`, with unseeded players left undefined. Behavior is proven by a test against a committed real-shape fixture, and the full suite remains green — a sound foundation for the priority + grouping work in Task 2.0.
