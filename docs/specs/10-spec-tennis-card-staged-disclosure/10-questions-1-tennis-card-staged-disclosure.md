# 10 Questions Round 1 - Tennis Card Staged Disclosure

Please answer each question below (check one or more options, or add your own notes). Feel free to add additional context under any question.

Context: Today the tournament card always lists every discipline section beneath its header, and each section is individually collapsible. You want the card itself to reveal content in stages: **collapsed → open once shows singles → open again shows doubles too.** These questions pin down the exact interaction so the spec is unambiguous.

---

## 1. What control advances the stages, and what does a further click do?

You described "open a second time" to reveal doubles. What is the full click cycle on the card's expand control?

- [ X] (A) Single toggle that cycles: **collapsed → singles → singles+doubles → collapsed** (each click advances; the click after "all shown" collapses back to the start)
- [ ] (B) Single toggle that advances **collapsed → singles → singles+doubles**, then stays on "all shown"; a separate/secondary control collapses it back
- [ ] (C) Two distinct affordances: the card header toggles collapsed↔singles, and a separate "Show doubles" control (inside the expanded card) reveals the doubles sections
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is the most literal match to "open, then open a second time," and keeps one obvious tap target that walks forward through the stages and wraps back — simplest to build, explain, and test.
- `(C)` is arguably the clearest for discoverability but adds a second control and more UI states than you asked for.
- `(B)` leaves the user with no clear way back to collapsed from the final stage, which tends to feel broken.

## 2. How do the per-section collapsibles behave under the new staged card?

Each discipline section (e.g. "Men's Singles") is currently its own collapsible dropdown, collapsed by default.

- [ X] (A) Keep them as-is: revealing a stage just makes those section headers appear; the user still taps each section to see its matches (collapsed by default)
- [ ] (B) Auto-expand sections as they're revealed so matches show immediately (no second tap needed within the card)
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` preserves existing, tested behavior (`MatchGroupSection` collapsed-by-default with "Show more") and layers the staged reveal cleanly on top — smallest change, least surprise.
- `(B)` could flood the card with match cards on first open, working against the "start collapsed / reveal gradually" goal you're pursuing.

## 3. Tournaments that have only singles OR only doubles — what should each stage show?

Not every tournament has all five sections (e.g. early rounds may be singles-only; some events may have no singles draw in the feed).

- [X ] (A) Singles-only event: stage 1 shows singles; there is no doubles stage (control does not advance to a doubles stage). Doubles-only event: stage 1 shows the doubles sections directly.
- [ ] (B) Always keep two reveal stages regardless; a stage with no matching sections simply shows an empty/"no doubles" state
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` avoids dead clicks and empty stages — the control only offers a second stage when doubles sections actually exist, and gracefully degrades for doubles-only events.
- `(B)` risks the user tapping to reveal "doubles" and getting an empty panel, which reads as a bug.

## 4. Should the header hint that more is hidden, and does state persist?

Two small UX/behavior details.

- [ X] (A) Add a lightweight affordance so users know clicking again reveals more (e.g. chevron plus a stage hint like "Singles" / "Singles + Doubles"), and let state reset to collapsed on each data refresh (no persistence)
- [ ] (B) Minimal affordance (chevron only, no text hint), state resets on refresh (no persistence)
- [ ] (C) Persist the per-card stage across refreshes/sessions
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` makes the staged behavior discoverable (otherwise users won't know a second click does anything) while keeping state ephemeral and simple — consistent with the current non-persisted `useState` sections.
- `(C)` adds storage/complexity not implied by your request; can be a later enhancement.
- `(B)` is cheaper but risks the second stage being undiscoverable.

---

Once you've answered, save the file and let me know — I'll re-check sufficiency and generate the spec.
