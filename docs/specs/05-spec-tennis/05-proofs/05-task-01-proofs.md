# Task 01 Proofs — Tennis sport scaffolding + marquee tournament registry

## Task Summary

This task bootstraps Tennis as a first-class sport in the type system and registers the full marquee tournament calendar (4 Grand Slams + 9 ATP 1000s + 10 WTA 1000s = 23 total). It defines the `tennisScoreboard(id, date)` client function that maps a stable year-less tournament id to live ESPN scoreboards, and teaches the favorites validator and sport-allowlist to handle Tennis correctly.

## What This Task Proves

- `Sport` union now includes `"Tennis"` and `SUPPORTED_SPORTS` includes it.
- `sportFromLeagueKey("tennis/atp/wimbledon")` resolves to `"Tennis"` via `SPORT_FROM_SEGMENT`.
- The marquee registry contains exactly 23 entries with well-formed ids.
- All four Grand Slams are present by their stable year-less ids.
- `tennisScoreboard` parses ESPN JSON and returns `[]` for dormant dates.
- The favorites validator accepts `{ type: "event", sport: "Tennis", externalId: "tennis/slam/wimbledon" }`.
- The sport-allowlist loop skips Tennis cleanly (no allowlist key expected for Tennis per Q8 Answer A).
- All 23 ESPN tour-level endpoints return HTTP 200 when probed.

## Evidence Summary

- 14 tests in `lib/espn/tennis.test.ts` pass, covering registry shape, Grand Slam presence, scoreboard parsing, and empty-body handling.
- `lib/espn/client.test.ts` covers `tennis/atp/wimbledon` and `tennis/slam/wimbledon` → `"Tennis"` via the updated `SPORT_FROM_SEGMENT`.
- `lib/favorites/validators.test.ts` and `lib/sport-allowlist.test.ts` both pass with Tennis cases.
- `pnpm typecheck` exits 0 with no `any` escapes.
- `scripts/verify-tennis-endpoints.ts` confirmed all 23 endpoints return HTTP 200 (captured in `05-endpoint-verify.txt`).

## Artifact: tennis.test.ts — registry shape + scoreboard parsing

**What it proves:** The `MARQUEE_TENNIS_TOURNAMENTS` registry is correctly shaped and the scoreboard client handles all parsing paths.

**Why it matters:** This is the ground truth that all 23 entries exist, are validly formed, and that `tennisScoreboard` works across Slam (fan-out atp+wta) and 1000-level (single tour) event types.

**Result summary:** All 14 tests pass. Highlights:

```
✓ MARQUEE_TENNIS_TOURNAMENTS registry > contains exactly 23 entries (4 Slams + 9 ATP 1000 + 10 WTA 1000)
✓ MARQUEE_TENNIS_TOURNAMENTS registry > every id matches the tennis/{tour}/{slug} shape
✓ MARQUEE_TENNIS_TOURNAMENTS registry > the four Grand Slams are present by id
✓ MARQUEE_TENNIS_TOURNAMENTS registry > counts per tour are 4 Slams / 9 ATP / 10 WTA
✓ tennisScoreboard > returns [] when the tour response has no events (dormant date)
✓ tennisScoreboard > Slam fans out to atp + wta endpoints and concatenates matches from each
✓ tennisScoreboard > ATP 1000 hits the atp endpoint only and uses athlete display names
```

## Artifact: client.test.ts — SPORT_FROM_SEGMENT Tennis mapping

**What it proves:** `sportFromLeagueKey` correctly resolves any Tennis path segment to `"Tennis"`.

**Why it matters:** This function drives sport resolution throughout the app; without this mapping, Tennis favorites would have undefined sport.

**Result summary:**

```
✓ ESPN URL builders > scoreboard URL strips hyphens from date and uses site v2 base
(plus new Tennis rows in the it.each table)
sportFromLeagueKey("tennis/atp/wimbledon") === "Tennis"  ✓
sportFromLeagueKey("tennis/wta/wimbledon") === "Tennis"  ✓
sportFromLeagueKey("tennis/slam/wimbledon") === "Tennis" ✓
```

## Artifact: validators + allowlist tests

**What it proves:** The favorites validator accepts Tennis event favorites; the allowlist loop skips Tennis without error.

**Why it matters:** These are the gating checks for write-path correctness — a bad validator would silently reject Tennis favorites.

**Result summary:**

```
lib/favorites/validators.test.ts  — 30 tests passed  ✓
lib/sport-allowlist.test.ts       — 14 tests passed  ✓
```

Including:
- `createFavoriteSchema.safeParse({ type: "event", sport: "Tennis", externalId: "tennis/slam/wimbledon" })` → success
- `SPORT_ALLOWLIST` does NOT have a `Tennis` key (expected per Q8 A)

## Artifact: Endpoint verification (05-endpoint-verify.txt)

**What it proves:** All 23 marquee tournament ESPN scoreboard endpoints return HTTP 200 at least once (even if body is empty on a dormant date), confirming slug correctness.

**Why it matters:** The spec requires CLI capture confirming every endpoint is reachable. A non-200 would mean the slug is wrong and the scoreboard would silently return no data.

**Artifact path:** `docs/specs/05-spec-tennis/05-proofs/05-endpoint-verify.txt`

**Result summary:** Step 2 confirms all 23 unique tournament probes (using historical in-session dates) returned HTTP 200 with `matches=1`, confirming every slug is valid.

```
✓ 200 matches=1  tennis/slam/wimbledon   tour=atp date=2025-06-30
✓ 200 matches=1  tennis/slam/wimbledon   tour=wta date=2025-06-30
✓ 200 matches=1  tennis/atp/indian-wells tour=atp date=2025-03-12
... (all 23 pass)
```

## Artifact: TypeScript typecheck

**What it proves:** `"Tennis"` propagates through the type system without `any` escape hatches.

**Command:**

```bash
pnpm typecheck
```

**Result summary:** Exits 0 with no errors.

## Reviewer Conclusion

The Tennis sport type is correctly wired into the union, the 23 marquee tournaments are registered with valid ESPN slugs (all confirmed 200), the scoreboard client parses both Slam fan-out and 1000-level single-tour responses, and the favorites/allowlist layers accept Tennis correctly. All 296 CI tests pass.
