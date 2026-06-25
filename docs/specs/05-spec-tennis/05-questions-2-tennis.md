# 05 Questions Round 2 — Tennis (follow-ups)

Round 1 picks left a few things underspecified. Five focused questions below.

## 1. Reconciling Q2 (C) + Q5 (B) — match-level data is now in scope

You picked **Q2 (C)** ("live match count: 3 matches in progress, 8 completed today") and **Q5 (B)** ("tap card expands inline to show today's matches"). Both require per-match parsing — the exact work I had recommended deferring. Given that, the framing of "tournament-level cards" partially collapses: we'll be parsing every match anyway.

Two reasonable shapes:

- [ ] (A) Keep the tournament-level card as the primary unit. Card collapsed = name + dates + round + counts (e.g. "3 live, 8 done"). Tap → expands inline to show today's match list (one row per match: player names, score/status). Match rows are a *new lighter primitive*, not the full MatchCard.
- [X] (B) Same as (A), but reuse the existing **MatchCard** component for the expanded rows so tennis matches look identical to NFL/MLB/etc.
- [ ] (C) Drop the tournament-level framing entirely. Show one match card per live/upcoming tennis match on the homepage, grouped under a small tournament header strip (no expand/collapse). Closer to how the rest of the homepage already works.
- [] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` matches your "tournament-level cards" framing while supporting the live-count and expand behaviors you picked. The lighter row primitive avoids forcing tennis (no team logos, players not teams, set scores not single integers) into a card built for team sports.
- `(B)` looks consistent but MatchCard pins logos and short-names that don't exist for tennis players, so it would need a lot of conditional rendering anyway.
- `(C)` is simpler but is essentially walking back your Q5 (B) pick — only choose this if you want to revisit that.

## 2. Q3 (B) annual rollover — how do `event` favorites survive a new year?

You picked **Q3 (B)** ("reuse `event` for tournaments — Wimbledon 2026 is one favoriteable event per year"). The favorites table currently stores `externalId` per event. Wimbledon 2026 and Wimbledon 2027 are different ESPN events. How should the favorite roll over?

- [ ] (A) Each year is a fresh event. User who favorited Wimbledon 2026 must re-favorite Wimbledon 2027 when it appears. (Manual rollover, no code complexity.)
- [X] (B) Use a stable, year-less `externalId` (e.g. `tennis/atp/wimbledon`) so the favorite carries forward indefinitely. The `displayName` says "Wimbledon"; the year is rendered from the active edition.
- [ ] (C) Use a stable `externalId` AND store a separate year-specific instance under metadata, so historical favorites are still queryable.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(B)]

**Why these are recommended:**

- `(B)` matches user intent ("I follow Wimbledon"), avoids annual user friction, and is simple in the schema (just an externalId convention).
- `(A)` is the simplest code path but creates a churn problem that affects every favorited tournament every year — bad UX.
- `(C)` is over-engineered for v1; we don't currently show favorite history anywhere.

## 3. Q4 (A) sort key — where do tournament cards land in the mixed feed?

You picked **Q4 (A)** ("mixed in with match cards, sorted by time/relevance"). Tournament cards span multiple days; they don't have a single "kickoff time."

- [ ] (A) Pin all active tournament cards above the match list, then the day's matches sorted by kickoff below.
- [X] (B) Sort tournament cards using the *earliest live or upcoming match* inside that tournament (so a tournament with a match starting in 10 min lands next to other 10-min-out matches).
- [ ] (C) Sort tournament cards using the tournament *start date* (Day 1 sits at the top of the feed; later-round days drift down).
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is the simplest and most predictable for users — tennis is always at the top during a Slam, then their team matches follow.
- `(B)` is "smart" but requires recomputing the sort key per render and produces visually flickery ordering on live updates.
- `(C)` makes sense for upcoming tournaments but feels arbitrary mid-tournament.

## 4. Live match count (Q2 C) — what counts as "in progress" and "completed today"?

- [] (A) **In progress** = ESPN status `in`; **completed today** = matches that started today (local tz) and are in status `post`. (Simple, ignores schedule weirdness.)
- [ ] (B) Same as (A) but tz = the tournament's local time (Wimbledon in BST, etc.). (More accurate to the venue.)
- [X] (C) **In progress** + **scheduled today not yet started** (e.g. "3 live, 5 still to come, 8 done"). (Most informative; biggest UI.) - let's do live, upcomping, done
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` uses the user's local date (consistent with the rest of the homepage's "today" semantics) and avoids per-tournament timezone metadata.
- `(B)` is more accurate but introduces a per-tournament timezone table to maintain.
- `(C)` is nicer info but pushes more text into the collapsed card.

## 5. Player names — short or full?

Tennis ESPN data carries each player as a single athlete. Most match cards in tennis read like "Alcaraz def. Sinner" rather than "Carlos Alcaraz". For the expanded match rows (Q1 above):

- [ ] (A) Last name only ("Alcaraz vs. Sinner") — matches broadcast convention, fits narrow rows.
- [X] (B) Full name ("Carlos Alcaraz vs. Jannik Sinner") — matches catalog data; longer.
- [ ] (C) First initial + last ("C. Alcaraz vs. J. Sinner") — disambiguates same surnames (Williams sisters, etc.).
- [ ] (D) Other (describe)

**Recommended answer(s):** [(C)]

**Why these are recommended:**

- `(C)` handles the Murray brothers / Williams sisters / Tsitsipas siblings case without manual disambiguation.
- `(A)` is shortest but ambiguous for the cases above.
- `(B)` is fine on desktop but eats horizontal space on mobile.

---

**Save and ping me when done.**

Clarification status: **insufficient — questions file required**.
