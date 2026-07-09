# 11 Questions Round 1 - Entity Match Detail (Team/Player match history)

Please answer each question below (check one or more options, or add your own notes under any question). When you're done, save the file and tell me — I'll read your answers and continue.

---

## 1. What does "a new window" mean here?

You said the matches "should appear in a new window and have a back button." ScoreMate is a mobile-first web app (App Router), so a literal browser tab/window isn't the usual pattern.

- [X] (A) A new **in-app screen** (its own route/URL, e.g. `/teams/[favoriteId]`) that slides in over the Teams tab, with a back button returning to Teams. Deep-linkable and back-button friendly.
- [ ] (B) A literal new **browser tab/window** (`target="_blank"`).
- [ ] (C) An in-place **expansion** on the Teams page (no navigation) that reveals the match list below/over the card.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` matches how the rest of the app is built (App Router routes under `app/(app)/`), gives you a real back button and a shareable URL, and is the standard mobile pattern for a "drill-in" detail screen.
- `(B)` breaks the single-page mobile feel and the "back button to the Teams tab" behavior you described (a new tab has no in-app back button).
- `(C)` is simpler but conflicts with your explicit "new window" + "back button" language and gets cramped showing 20 full-size scorecards inline.

---

## 2. Which favorites should the detail screen support in v1?

The Teams page lists both **teams** (e.g. Arsenal) and **players** (e.g. Messi, Coco Gauff). Behind the scenes these use different data sources:

- **Teams** already return a full schedule (`teamScheduleForLeague`) with complete match data — logos, scores, both sides — so Home-style scorecards render cleanly.
- **Players** currently only return a single last/next summary (`athleteSchedule`); building 10+ full Home-style scorecards for a player (especially **tennis** players) needs new/extended data work and is materially larger.

- [X] (A) **Teams and players both**, full fidelity from day one.
- [ ] (B) **Teams first** (full support); players show a simple message ("Match history coming soon") or a basic list until a follow-up spec.
- [ ] (C) **Teams and team-sport players** (e.g. Messi), but **defer tennis players** to a later spec.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(B), or (C) if players matter to you now]

**Why these are recommended:**

- `(B)` keeps this spec a clean, demoable slice: teams already have exactly the data Home-style cards need, so it ships fast and looks great. Players get a graceful placeholder and a dedicated follow-up spec where the data work can be scoped properly.
- `(C)` is a reasonable middle ground if you specifically want player support now, but tennis players are the hardest case (different card component + different data path), so deferring them keeps risk down.
- `(A)` is achievable but noticeably enlarges this spec and risks uneven quality on the tennis path. If you pick `(A)`, expect the tennis-player card work to dominate the effort.

You may be misunderstanding here: for example, if i click on "jannik sinner" in the teams page, show matches for jannik sinner. If i Click "Chicago Bulls", show games for the chicago bulls.
---

## 3. Which card component should render each match?

Home doesn't use one card type — it uses **`MatchCard`** for team sports (Arsenal vs Chelsea) and **`TournamentCard` → `TennisMatchCard`** for tennis. "Identical to the Home screen" means different components per sport.

- [X] (A) Use **`MatchCard`** for team-sport matches and **`TennisMatchCard`** for tennis matches — i.e. each match looks exactly like it would on Home.
- [ ] (B) Use **`MatchCard`** for everything (simpler, but tennis loses its set-by-set styling).
- [ ] (C) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is the literal reading of "look identical to the ones on the Home screen" — reusing the exact components guarantees visual and behavioral parity and no duplicated styling.
- `(B)` would make tennis matches look wrong (no flags/set scores), contradicting the "identical" requirement.
- Note: `(A)`'s tennis path only applies if you include tennis players in Q2; for teams (all non-tennis) `MatchCard` is the answer regardless.

---

## 4. How should the 10 recent + 10 upcoming matches be laid out?

You asked for "the most recent 10 matches ... and then the next 10 matches as well."

- [ ] (A) Two labeled sections: **"Recent"** (last 10 completed, most-recent first) then **"Upcoming"** (next 10, soonest first). Clear headers like the Home day-tabs styling.
- [X] (B) One continuous chronological list (past → future) with a subtle "today" divider. But it should auto-scroll to the most recent match first, and if you scroll up, it should show you the previous matches.
- [ ] (C) Collapsible sections (like Home's league groups), Recent expanded by default.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` maps directly to your wording ("recent 10 ... then next 10"), is easy to scan on mobile, and keeps completed vs upcoming visually distinct.
- `(C)` matches an existing Home pattern and is a fine alternative if you like everything collapsible, but adds interaction the request didn't ask for.
- `(B)` is elegant but blurs the "recent vs next" split you explicitly called out.

---

## 5. How should the user open the detail screen from the Teams page?

Today the entity cards aren't clickable.

- [X] (A) Make the **whole entity card** tappable (the card becomes the link/button to the detail screen).
- [ ] (B) Add a small **"View matches" / chevron affordance** on each card; the rest of the card stays non-interactive.
- [ ] (C) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` matches your phrasing ("when you click on the player or team") and gives a large, mobile-friendly ≥44px touch target — consistent with repo touch-target conventions.
- `(B)` is more discoverable-as-a-button but adds visual clutter to a currently-clean card and a smaller tap target.
- Accessibility note: whichever we pick, the card/affordance will be a proper link/button with an accessible label (e.g. "View Arsenal matches").

---

## 6. What should happen when there aren't 10 recent or 10 upcoming matches?

Off-season teams, newly-created seasons, or sparse player data may have fewer than 10 on either side.

- [X] (A) Show **however many exist** (up to 10 each); if a section is empty, show a short empty message ("No recent matches" / "No upcoming matches").
- [ ] (B) Always require exactly 10; hide the screen otherwise.
- [ ] (C) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is the only robust option — real schedules routinely have fewer than 10 on one side, and gracefully showing what exists matches how the Teams/Home pages already degrade (e.g. "Match data unavailable").
- `(B)` would leave the screen broken for common real-world cases.

---

## 7. Anything specific for the detail screen header?

- [X] (A) Header shows the **entity name + crest/badge** (reusing the existing badge) and a back button; nothing else.
- [ ] (B) Header also shows lightweight **summary stats** (e.g. recent W-L record).
- [ ] (C) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` keeps v1 focused ("pretty, simple") and matches your description — a back button plus the team/player identity.
- `(B)` is a nice enhancement but adds computation/scope beyond "show the matches"; better as a follow-up.
