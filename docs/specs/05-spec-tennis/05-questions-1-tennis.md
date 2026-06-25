# 05 Questions Round 1 — Tennis (tournament-level cards)

Please answer each question below (select one or more options, or add your own notes). Feel free to add additional context under any question.

## 1. Scope of tours/tournaments to include in v1

Tennis breaks down into multiple parallel tours. ESPN exposes them as separate scoreboards. Which should v1 cover?

- [ ] (A) ATP + WTA + all four Grand Slams
- [ ] (B) Grand Slams only (Australian Open, Roland Garros, Wimbledon, US Open)
- [ ] (C) ATP + WTA tour events of any level (250 / 500 / 1000) + Slams
- [X] (D) Marquee only: Slams + ATP/WTA 1000s
- [ ] (E) Other (describe)

**Current best-practice context:** ESPN's tennis API is per-tournament rather than per-league; each Slam, ATP/WTA 250/500/1000 event has its own scoreboard endpoint that only returns data when the tournament is in progress. Smaller scopes mean fewer dormant endpoints to poll.

**Recommended answer(s):** [(D)]

**Why these are recommended:**

- `(D)` gives strong year-round coverage (Slams + ~18 marquee tour events) without the long tail of small ATP 250 events that most users don't care about.
- `(A)` and `(C)` add 30+ tournaments per year, most of which have low user interest, and quadruple the per-day fetch fan-out.
- `(B)` is the smallest scope but creates an empty feed for ~38 weeks of the year between Slams.

## 2. What goes on a tournament-level card

The card model is new — match cards show two teams + score. What should a tournament card display?

- [ ] (A) Static only: tournament name, dates, venue, surface
- [ ] (B) (A) + current round (e.g. "Quarterfinals — Day 9 of 14")
- [X] (C) (B) + live match count ("3 matches in progress, 8 completed today")
- [ ] (D) (C) + a single featured headline match (e.g. top remaining seed currently on court)
- [ ] (E) Other (describe)

**Recommended answer(s):** [(B)]

**Why these are recommended:**

- `(B)` gives meaningful at-a-glance status without requiring per-match score parsing on the homepage.
- `(C)` and `(D)` are nicer UX but require either a second ESPN call or per-match parsing inside the cache layer; that's more work and a different cache invariant than match cards.
- `(A)` is too static to be worth a homepage slot.
- We can layer up to `(C)` or `(D)` in a future spec without breaking the card contract.

## 3. How are tennis favorites modeled?

`FavoriteType` is currently `team | sport | league | event`. None of these are an exact fit for "a tennis tournament."

- [ ] (A) Favoriting `Tennis` as a `sport` is the only way; individual tournaments are not favoritable in v1
- [X] (B) Reuse `event` for tournaments — e.g. Wimbledon 2026 is one favoriteable event per year
- [ ] (C) Reuse `league` for tournaments (each Slam / ATP 1000 acts like a "league")
- [ ] (D) Add a new `tournament` favorite type
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is the smallest model change and matches "I follow tennis" intent for most users. The homepage shows all currently-active marquee tournaments.
- `(B)` collides with Spec 03's `event` semantics (a single match/game), and creates annual churn (Wimbledon 2026 ≠ Wimbledon 2027).
- `(C)` distorts what "league" means; the rest of the codebase treats league = recurring scheduled season.
- `(D)` is the cleanest model long-term but adds a new FavoriteType, DB migration, search type, and validator branch — significantly larger spec.
- If users later want to follow only specific Slams, that's a Spec 06+ extension.

## 4. Where do tournament cards appear?

- [X] (A) On the existing homepage, mixed in with match cards (sorted by time/relevance)
- [ ] (B) On the existing homepage in a dedicated "Tennis" section above/below the match list
- [ ] (C) On a separate `/tennis` route reached from the homepage
- [ ] (D) Other (describe)

**Recommended answer(s):** [(B)]

**Why these are recommended:**

- `(B)` keeps tennis discoverable on the existing homepage but doesn't intermingle two visually different card types (which would force layout compromises on both).
- `(A)` looks tidy in mockups but match-vs-tournament cards have different aspect ratios, no "score" concept on tournament cards, and no good sort key.
- `(C)` hides tennis behind navigation, which contradicts the "I favorited Tennis to see it on my homepage" story.

## 5. Tap-through behavior

What happens when a user taps a tournament card?

- [ ] (A) Nothing — informational only
- [X] (B) Expands inline to show today's matches in that tournament
- [ ] (C) Navigates to a per-tournament route (e.g. `/tennis/atp/wimbledon`) showing today's match list
- [ ] (D) Opens ESPN's tournament page in a new tab
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` keeps Spec 05 to a single demoable surface and matches the original "tournament-level cards" framing.
- `(B)` and `(C)` require per-match parsing (the same work that pushed match-level out of scope) and a second route or expanded-state component.
- `(D)` works but feels like an off-ramp for a user who came to score-mate specifically to avoid bouncing to ESPN.

## 6. Data source / ingestion shape

ESPN's tennis API is per-tournament, not per-league.

- [ ] (A) ESPN per-tournament scoreboard endpoints (e.g. `site.api.espn.com/.../tennis/atp/scoreboard?league=wimbledon`)
- [ ] (B) Build a hardcoded annual calendar of marquee tournaments (start/end dates per year) and only call ESPN during a tournament's active window
- [X] (C) Hybrid: hardcoded list of tournament identifiers; date-range driven by ESPN's response
- [ ] (D) Other (describe)

**Recommended answer(s):** [(C)]

**Why these are recommended:**

- `(C)` avoids hand-maintaining annual calendar data (date drift) while still preventing useless fetches during the ~38 weeks when a tournament isn't active.
- `(A)` works but fans out to ~20 endpoints/day even when most are returning empty scoreboards.
- `(B)` is precise but requires a yearly maintenance burden; misses last-minute schedule changes.

## 7. Caching TTL and invalidation

The existing homepage cache buckets TTLs by day (today=30s, tomorrow=5m, yesterday=1h). Tennis tournaments span 1–2 weeks.

- [ ] (A) Reuse the existing day-bucket TTLs as-is (each daily call cached separately)
- [ ] (B) Add a tournament-level cache layer: `getActiveTournaments(today)` cached for 1h, returning the list of cards
- [X] (C) (B) + bump `CACHE_KEY_PREFIX` to invalidate prior cached results on deploy
- [ ] (D) Other (describe)

**Recommended answer(s):** [(C)]

**Why these are recommended:**

- `(B)` is the right shape — tournament status changes slowly within a day, so a 1h cache key for the active-tournaments list is appropriate.
- `(C)` is the established pattern from Spec 03 / Spec 04 (the cache prefix bumps on data-shape changes).
- `(A)` would re-fetch every tournament's metadata every 30s — wasteful for a slowly-changing field.

## 8. Open question: tennis allowlist

`SPORT_ALLOWLIST` filters which leagues count for each sport. Tennis won't have "leagues" in the existing sense.

- [X] (A) Skip the allowlist for Tennis — any active tournament from the configured tour set surfaces
- [ ] (B) Add a Tennis block listing each marquee tournament by name (string-match)
- [ ] (C) Add a Tennis block keyed on the tour (ATP / WTA / Slam) rather than tournament
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` follows from Q1 + Q6: if v1 only ingests marquee tournaments, the ingestion config IS the allowlist.
- `(B)` duplicates the marquee list in two places.
- `(C)` is a reasonable middle ground but only matters if Q1 picks something broader than (D).

---

**Once you've answered, save the file and tell me. I'll re-check sufficiency and either move to drafting the spec or ask one more round.**

Clarification status: **insufficient — questions file required**.
