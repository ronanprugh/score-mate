# 04 Questions Round 1 — Add Tennis and Baseball

Please answer each question (select one or more options, or add notes).

> **Quick context from an ESPN probe just now:**
>
> - **Baseball** (`baseball/mlb`, `baseball/college-baseball`) follows the same per-league scoreboard shape as every other sport we already support. Drop-in compatible with the existing aggregator. Pulled a real MLB scoreboard with 10 events — works.
> - **Tennis** does NOT. `tennis/atp/scoreboard` returns *tournaments* as events (with `groupings`, `major`, `endDate` fields), not matches. Match-level data is nested inside `groupings` and would need a separate ingestion pipeline. This is why Spec 03 dropped Tennis (Q3 (G)).

---

## 1. Scope split — bundle or sequential?

Two sports, two complexity profiles. How do you want to ship?

- [X] (A) **Two specs, baseball first.** Spec 04 = baseball only (small, fits the existing model, can ship this week). Spec 05 = tennis (separate design, needs the per-tournament pipeline).
- [ ] (B) **One bundled spec.** Both sports in Spec 04. Bigger PR, more concurrent design, longer time to first demo.
- [ ] (C) **Baseball now, tennis later as needs warrant.** Ship Spec 04 for baseball; defer tennis indefinitely (or until you have a strong personal use case).
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- Baseball is a near-mechanical extension of the existing `SUPPORTED_LEAGUES` registry — adding it as its own spec keeps the change reviewable in a single sitting.
- Tennis genuinely needs a different ingestion model (per-tournament fan-out, possibly a tournaments calendar), and bundling it forces baseball to wait on that design. (B) makes the PR larger without making either piece better.
- (C) is the right call if tennis is "nice-to-have but not blocking"; (A) is better if you know you want tennis in the near term.

---

## 2. Baseball league coverage

For Spec 04 (baseball). Which leagues should the v1 add include?

- [ ] (A) **MLB only** (`baseball/mlb`). 30 teams. Minimal, mirrors the NFL-only choice users might prefer for North-American sports.
- [X] (B) **MLB + NCAA D-I baseball** (`baseball/mlb` + `baseball/college-baseball`). NCAA adds ~300 teams to the catalog. Adds College World Series visibility.
- [ ] (C) **MLB + LMB (Mexican)** (`baseball/lmb` if ESPN exposes it). Less common.
- [ ] (D) **MLB + NCAA + Minor leagues** (large; uneven ESPN coverage).
- [ ] (E) Other (describe in notes)

**Recommended answer(s):** [(A) for v1; revisit (B) later]

**Why these are recommended:**

- MLB-only is the smallest demoable slice — 30 teams, one scoreboard endpoint, ships fast.
- (B) is fine if you watch college baseball; the catalog cost is modest (we already carry 755 college-football teams). The harder question is whether NCAA baseball has interesting season windows for *you*.
- (C)/(D) need a use-case justification; happy to add later when needed.

---

## 3. Tennis ingestion model (for whichever spec ships it)

ESPN's tennis API is per-tournament, not per-league. Match-level data sits inside `groupings[].competitions[]` under each tournament event. Pick the v1 approach:

- [ ] (A) **Hand-curated tournament catalog.** Hardcode a list of "the tournaments that matter" (4 Grand Slams + ATP/WTA Masters 1000s + ATP/WTA Finals — ~14/year). For each, fetch the tournament scoreboard then walk `groupings` for match data. Update the list annually like the events catalog. Predictable, small surface area.
- [X] (B) **Dynamic discovery.** Hit `tennis/atp/scoreboard` and `tennis/wta/scoreboard` for each date in the window; treat each returned "event" as a tournament, expand its `groupings`. No hand-maintained list. More moving parts but always current.
- [ ] (C) **Slams + Finals only.** Hardcode 6 tournaments/year (AO, RG, Wimbledon, US Open, ATP Finals, WTA Finals). Simplest possible scope.
- [ ] (D) **Different provider for tennis.** Use a paid sports API for tennis only (e.g., Sportradar, API-Tennis). Highest data quality, ongoing cost, dual-provider surface area.
- [ ] (E) **Skip tennis again.** Defer to a later spec when there's clearer demand.
- [ ] (F) Other (describe)

**Recommended answer(s):** [(B) if you actively follow tennis; (C) if you just want marquee events]

**Why these are recommended:**

- (B) is the most honest fit for ESPN's actual API shape — no hand-curated list to drift out of date, and it naturally covers every tournament ESPN considers worth listing.
- (C) is appropriate if you only care about the Slams + Finals — tiny surface area, easy to ship.
- (A) splits the difference but inherits the maintenance burden of the hand list without the benefits of either extreme.
- (D) brings in a paid provider for one sport; not recommended unless ESPN tennis quality turns out to be unusably bad.

---

## 4. Tennis favorite unit

Today's favorite types are `team | league | sport | event`. Tennis has no "teams" and no real "leagues" (ATP/WTA are tours, not leagues with stable rosters). What should a tennis favorite *be*?

- [ ] (A) **Player favorites** (new favorite type). User favorites "Carlos Alcaraz", "Coco Gauff". Requires a player catalog (ATP/WTA top-100 maybe), changes to the favorite type enum + schema.
- [X] (B) **Tournament-instance favorites only.** Reuse the existing `event`-type favorite. User favorites "Wimbledon 2026", "US Open 2026". No schema change. Date-windowed (silent-expire already works).
- [X] (C) **"Tennis" sport favorite only.** Single favorite shows all matches across the curated/discovered tournaments. Coarsest, simplest.
- [ ] (D) **(A) + (B) + (C) — full menu.** Most flexible, most code.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(B) + (C)]
<UserAnswer>Let's do both B and C, for now</UserAnswer>

**Why these are recommended:**

- (B) reuses the event-favorite machinery we already built for World Cup / Super Bowl — zero schema change.
- (C) is one extra entry in the sport allowlist, also free.
- (A) is real product value but introduces a new favorite type + player catalog + DB-schema change. Worth its own spec rather than slipping into v1.

---

## 5. Catalog file shape

Current `lib/espn/catalog.json` is one big committed file (1,675 teams). Adding MLB (+30) is negligible; adding NCAA baseball (+300) is fine too. Tennis players (if (A) on Q4) could be 100–200 entries.

- [X] (A) **Keep one `catalog.json`.** Add a `sport` field to every row (already there), keep it flat. ~2k rows after baseball, ~2.2k after tennis. Still small.
- [ ] (B) **Split per sport** (`catalog-baseball.json`, etc.). Better git diff hygiene when one sport's roster changes, more files to manage.
- [ ] (C) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- We're at 1,675 rows / ~150 KB and the catalog loads instantly. No measurable cost to staying flat.
- Splitting per sport adds two extra modules to wire into the search route for no current benefit.
- Easy to revisit later if the catalog ever bloats past, say, 10k rows.
