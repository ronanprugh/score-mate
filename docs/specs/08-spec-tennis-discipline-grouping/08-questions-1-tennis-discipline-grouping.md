# 08 Questions Round 1 - Tennis Men/Women Grouping + Ranked Match Priority

Please answer each question below (check one or more options, or add notes under any question). When done, save the file and tell me to continue.

**What I understand you want:**

1. Inside a tennis tournament card, split matches into **two dropdowns — Men and Women** (each expands to show its matches).
2. Because a full round can be huge (e.g. 32 + 32 = 64 matches), show only the **top 5 matches per dropdown** initially, with a **"Show more"** control to reveal the rest.
3. Choose which 5 to show first by a **priority score** based on the two players' rankings (lower number = better = higher priority):

   > `priority = (bestRank × 2 + adjustedSecondRank) / 3`
   > where `bestRank` = the better (lower) of the two players' rankings, and `adjustedSecondRank` = the other player's ranking, **capped at 100 only when the top player is inside the top 100**; if **both** players are outside the top 100, use the second player's actual ranking (no cap).
   > **Lowest priority number is shown first.**

**Critical context:** Today we do **not** extract any player ranking or seed from ESPN — the tennis data model only has name, flag, and set scores. So this feature depends on ranking data we'd have to add, and its availability is uncertain. Questions 1–2 are the gating ones.

---

## 1. Ranking data source (GATING — determines feasibility)

The formula needs a number per player. Which number, and from where?

- [X] (A) **ATP/WTA world ranking** parsed from the ESPN scoreboard payload (e.g. a `curatedRank`/`rank` field on each competitor), if present. We add a parsing step + a spike to confirm the field exists in the live payload before building.
- [ ] (B) **Tournament seed** (the player's seed in this event, e.g. "[1]", "[15]"), parsed from ESPN if present. Unseeded players are treated as unranked.
- [ ] (C) Either — use world ranking if available, fall back to seed, then to "unranked".
- [ ] (E) Other (describe — e.g. a specific ESPN endpoint/field you know carries it)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- Your formula language ("100th in the world") describes **world ranking**, so `(A)` matches intent most directly.
- `(A)` requires a short verification spike first, because if the scoreboard payload doesn't carry ranking we'll need a different source (or fall back to Q2's rule). Flagging that now avoids building on a missing field.
- `(C)` is the most robust but adds two code paths and fuzzier acceptance criteria; pick it only if you want maximum resilience.

---

## 2. What happens when a player has NO ranking at all?

Qualifiers, wildcards, and lower-tier draws often have no world ranking (distinct from "ranked but outside the top 100"). How should such matches be prioritized?

- [X] (A) Treat a missing ranking as a **large sentinel number** (e.g. 9999) so the match still gets a priority and simply sorts toward the bottom. Match is still shown (just later, under "Show more").
- [ ] (B) Give matches where **either** player is unranked the **lowest priority** (always after every fully-ranked match), ordered among themselves by whatever ranking is available.
- [ ] (C) Exclude unranked matches from the top-5 entirely, but still list them under "Show more".
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` keeps the formula simple and total (every match gets a comparable number), which is the easiest to test and reason about.
- `(A)` and `(B)` produce nearly identical ordering; `(A)` avoids a special-case branch. `(C)` risks hiding a marquee player who happens to face a qualifier.

---

## 3. Which players' matches — singles only, or doubles/mixed too?

Your "32 + 32" example is a singles round of 64. Ranking priority is well-defined for singles; doubles has team rankings and mixed pairs a man + woman.

- [ ] (A) **Singles only.** Men dropdown = Men's Singles, Women dropdown = Women's Singles. Doubles/mixed are out of scope for this spec.
- [ ] (B) Singles + doubles: Men dropdown includes Men's Singles **and** Men's Doubles; Women includes both women's draws. Mixed doubles excluded (no single gender).
- [X] (C) Everything, with mixed doubles placed in one of the dropdowns (describe which) or its own section.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` keeps the priority formula unambiguous (one ranking per player) and matches your 64-singles example.
- `(B)`/`(C)` force decisions about doubles-team ranking and mixed-gender placement that would complicate the formula and the two-dropdown model. Easy to add in a later spec once singles works.

<userAnswer>
Let's have separate sections for doubles (men's, womens's, and mixed, and treat the average of the two player's single's rankings as the combined "team ranking")
</userAnser>


---

## 4. "Higher seed" definition & tie-breaking

Confirming the mechanics so the formula is testable.

- [X] (A) **"Higher seed" = the player with the better (lower) ranking of the two**, regardless of who is listed as home/away. When two matches have an equal priority number, break the tie by **earliest scheduled start time**, then match id.
- [ ] (B) "Higher seed" = the home/first-listed competitor as ESPN returns them (no reordering). Ties broken by start time.
- [ ] (E) Other (describe tie-break preference)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` matches the plain meaning of "higher-seeded player" and makes the result independent of ESPN's arbitrary home/away ordering.
- A deterministic tie-break (start time → id) is needed so the top-5 selection is stable and unit-testable.

---

## 5. "Show more" behavior & live matches

How the truncation behaves once expanded.

- [ ] (A) Each dropdown shows the top **5** by priority; a **"Show more (N)"** button reveals **all** remaining matches at once; a "Show less" collapses back to 5. Matches are ordered by priority throughout.
- [ ] (B) "Show more" reveals the next 5 each click (incremental paging) rather than all at once.
- [ ] (C) Same as (A), **but any live match is always shown in the top group** regardless of its priority score (live pinned first, then top priority up to 5).
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)] (add **(C)** if you want live matches always visible)

<userAnswer>let's do B (5 at a time) but with C showing any live matches first</userAnswer>

**Why these are recommended:**

- `(A)` is the simplest, most predictable behavior and easiest to demo/test with a fixed threshold of 5.
- `(C)` is a strong UX addition for a live-scores app (users likely want in-progress matches surfaced even if seeds are low) — worth adding if you agree; it slightly complicates the ordering rule.
- `(B)` adds paging state for little benefit at these list sizes.
