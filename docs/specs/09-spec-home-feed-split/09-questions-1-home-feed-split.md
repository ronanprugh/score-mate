# 09 Questions Round 1 - Home Feed Split (Teams/Players vs Leagues)

Please answer each question below (select one or more options, or add your own notes). Feel free to add additional context under any question.

---

## 1. Where does the Teams/Players view live in the navigation?

Right now the bottom nav has three destinations: **Home · Favorites · Settings**. Where should the Teams/Players split appear?

- [] (A) Two tabs *within* the existing Home page — a "Leagues" tab and a "Teams" tab rendered as a tab strip at the top of the Home content area. Bottom nav stays as-is (3 items).
- [X] (B) A brand-new bottom nav destination — **Teams** gets its own icon + label in the bottom nav, distinct from Home (which becomes "Leagues only"). The nav would have 4 items: Home · Teams · Favorites · Settings.
- [ ] (C) Replace the existing Home tab with two separate bottom nav destinations: **Leagues** and **Teams** (so the nav stays at 4: Leagues · Teams · Favorites · Settings, and the current "Home" label disappears).
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why this is recommended:**
- Option (A) keeps the nav at 3 items, which is already well-designed in Spec 07. Changing the nav item count risks disrupting the touch-target layout and requires another nav component update.
- A tab strip inside Home is a natural pattern for splitting the same conceptual space ("what's happening for my favorites?") into two views — it avoids making the user think about whether to go to "Home" or "Teams" when they want scores.
- Options (B) and (C) make the Teams concept a first-class nav destination, which could be appropriate if Teams content is sufficiently different — but that is a bigger navigation restructure.

---

## 2. Should individual players (e.g. Coco Gauff) be a new searchable favorite type?

The current favorites schema supports types: `team`, `sport`, `league`, `event`. There is no `player` type. Favoriting Coco Gauff would require either:

- [X] (A) Add a new `player` favorite type: new DB enum value, new search logic in the ESPN catalog (searching by athlete name), new match-filtering logic (a "player" match is one where the player appears in the competitor list). This is significant scope.
- [ ] (B) For now, skip individual player support. Tennis players are already surfaced via the "Tennis" tournaments on the home page (Wimbledon bracket). The Teams tab shows `team`-type favorites only. Players can be a future spec.
- [ ] (C) Treat individual tennis players as a special case via the existing tennis tournament aggregator — no new favorite type, but the Teams tab surfaces "your player is active in a tournament" by cross-referencing existing tennis data.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(B)]

**Why this is recommended:**
- Adding a `player` type requires: a DB migration to extend the `favorite_type` enum, ESPN player-search API integration (different endpoint from team/league search), and new match-filtering logic to find matches where a specific athlete competed. This is likely a spec of its own.
- Option (B) scopes this spec cleanly to the feed-split concept. The Teams view shows team favorites (e.g., US Men's National Team) with a concise last/next match layout.
- Option (C) is creative but would couple the Teams tab to the tennis aggregator in a fragile way, and still doesn't let the user "follow Coco Gauff" as an explicit favorite.
- If player favorites are important to ship alongside the split, they should probably be a parallel or follow-up spec (Option D: note that in your answer).

---

## 3. What does the Teams/Players card look like?

For a followed **team** (e.g. US Men's National Team), what does the card in the Teams tab show?

- [X] (A) A compact "entity card" per team showing: team name, then two rows — **Last match** (score + opponent + date) and **Next match** (opponent + date/time). No Yesterday/Today/Tomorrow tabs.
- [ ] (B) The same Yesterday/Today/Tomorrow tab strip as the current Home page, but filtered to only show matches for followed teams (so no league-wide content, just your teams' games).
- [ ] (C) A scrollable list of all matches for followed teams in the same Yesterday/Today/Tomorrow window, grouped by team name instead of by league.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why this is recommended:**
- Option (A) gives each followed entity its own card, which matches the user's description ("I click on the Teams tab and it shows her most recent match and next match"). This is a distinct and more focused UX than the current league-grouped feed.
- Option (A) doesn't require the Yesterday/Today/Tomorrow date infrastructure — it's a simpler "lookup last result + next fixture" pattern for each team.
- Options (B) and (C) reuse the existing day-tab frame, which might make the Teams tab feel redundant with the Leagues tab if your team also plays in a league you follow.
- The main risk with (A) is that fetching "last match before today" and "next match after today" requires a different API query than the current date-window approach. Confirm this tradeoff is acceptable.

---

## 4. What should the Leagues tab show?

Currently Home shows matches for ALL favorites (teams + leagues + sports + events). If we split into tabs, what belongs in the Leagues tab?

- [X] (A) Only matches coming from `league`, `sport`, and `event` type favorites — team matches are excluded from this tab (they go to the Teams tab only).
- [ ] (B) Everything currently shown on Home — teams, leagues, sports, events — grouped by league as today. The Teams tab is an *additional* view, not a replacement. So a followed team's matches appear in BOTH tabs.
- [ ] (C) Only `league` and `event` type favorites. `sport` favorites (e.g. "all Basketball") move to a future discovery feature.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why this is recommended:**
- Option (A) creates a clean mental model: Leagues tab = "what's happening in competitions I follow," Teams tab = "how are my specific teams/athletes doing." No duplication.
- Option (B) means the Leagues tab is unchanged from today, which is simpler to build but leaves the user confused about why the Teams tab exists (their team's match appears in both).
- Option (C) removes sport favorites from the leagues feed, which may break existing behavior users already rely on.
- If the user prefers showing everything in Leagues and just adding Teams as bonus context, option (B) is also reasonable — clarify in your answer.
