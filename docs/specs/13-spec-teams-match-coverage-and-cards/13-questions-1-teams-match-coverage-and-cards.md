# 13 Questions Round 1 - Teams Match Coverage and Cards

Please answer each question below (select one or more options, or add your own notes). Feel free to add additional context under any question.

---

## Diagnosis so far (context for the questions below)

I reproduced the Liverpool bug directly against ESPN. Both `/api/teams` and
`/api/teams/[favoriteId]/matches` call `teamScheduleForLeague(leagueKey, teamId)`
([lib/espn/client.ts:912](lib/espn/client.ts:912)), which hits exactly one URL:

`https://site.api.espn.com/apis/site/v2/sports/{leagueKey}/teams/{teamId}/schedule`

Live results for Liverpool (ESPN team id `364`), run today (2026-08-05):

| URL | Events returned |
| --- | --- |
| `soccer/eng.1/teams/364/schedule` (what we call today) | **0** |
| `soccer/eng.1/teams/364/schedule?season=2025` | 38 (the completed 2025-26 Premier League season) |
| `soccer/uefa.champions/teams/364/schedule?season=2025` | 12 (Champions League) |
| `soccer/club.friendly/teams/364/schedule` | 3 (Sunderland, Wrexham, Leeds — the missing preseason friendlies) |

So there are **two independent root causes**:

- **Cause A — season rollover.** With no `season` param, ESPN resolves to the
  *upcoming* 2026-27 season, which has no fixtures published yet, and returns
  an empty `events` array. Liverpool therefore shows "Match data unavailable"
  even though 38 completed matches and 3 friendlies exist. This will recur
  every offseason, for every sport, not just soccer.
- **Cause B — single-competition coverage.** We only query the team's *primary*
  league key from the catalog. Cup runs, continental competitions
  (`uefa.champions`), and friendlies (`club.friendly`) live under different
  league keys and are never fetched. `club.friendly` is not even in
  `SUPPORTED_LEAGUES` ([lib/espn/leagues.ts](lib/espn/leagues.ts)).

Both fixes add ESPN round-trips, which is why Q3 (perf budget) matters — Spec
12 just finished tightening this exact code path.

On the redesign: the **detail** screen (`/teams/[favoriteId]`) *already* renders
full `MatchCard`s ([components/entity-matches-client.tsx:12](components/entity-matches-client.tsx:12)).
The **list** screen (`/teams`) is the one showing the compact scoreline rows via
`EntityCard` ([components/entity-card.tsx](components/entity-card.tsx)). Q4/Q5
confirm which screen you meant and what the new layout should be.

---

## 1. Season fallback strategy (Cause A)

When the default schedule call returns no usable events, what should the system do?

- [ ] (A) Fetch the current season explicitly, and when it yields zero events, retry once with `season = currentYear - 1`; merge whatever comes back
- [ ] (B) Always fetch both the current and previous season in parallel and merge, regardless of whether the current season is empty
- [ ] (C) Only retry the previous season when we are inside a known offseason window (e.g. June-August for soccer)
- [ ] (D) Leave the season logic alone and solve this purely by widening competition coverage (Q2)
- [ ] (E) Other (describe)

**Current best-practice context:** ESPN's site-v2 `/schedule` endpoint has no
documented contract for season resolution; it silently rolls to the next season
once one is registered. The commonly used mitigation is a bounded
previous-season retry rather than date heuristics, because season boundaries
differ per sport (NFL rolls in Feb, MLB in Nov, soccer in Jun) and ESPN
registers them at unpredictable times.

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` costs one extra request only in the failure case, so it adds zero
  latency during a normal in-season load — important given Spec 12 just
  optimized this path.
- `(B)` always doubles the request count for every team on every load to solve a
  problem that exists for a few weeks a year; only choose it if you want
  cross-season continuity (last season's finale *and* next season's opener
  visible at the same time) as a permanent feature.
- `(C)` hardcodes sport-specific calendar knowledge that will silently rot; it
  is the most fragile option.
- `(D)` does not actually fix Liverpool — the friendlies would appear, but the
  38 completed league matches would still be missing.

---

## 2. Competition coverage (Cause B)

Which competitions should a followed team's matches be gathered from?

- [ ] (A) The team's primary league only, plus friendlies (`club.friendly`) — 2 calls per soccer team
- [ ] (B) The primary league plus every supported league in that team's sport that the team actually appears in — highest coverage, most calls
- [ ] (C) A curated per-sport companion list (for soccer: primary league + `club.friendly` + the two domestic cups + the three UEFA competitions)
- [ ] (D) Primary league only — treat missing cups/friendlies as expected behaviour and fix only the season bug
- [ ] (E) Other (describe)

**Current best-practice context:** ESPN exposes `/teams/{id}/schedule` per
league key, so there is no single "all competitions for this team" endpoint on
site-v2. Any broader coverage is a fan-out the app performs itself. The
`sports.core.api.espn.com` per-league team-events endpoint can cheaply answer
"does this team have events in league X this season?" (returns `count: 0` for
leagues the team is not in), which makes a probe-then-fetch pattern viable.

**Recommended answer(s):** [(C)]

**Why these are recommended:**

- `(C)` matches how a fan actually thinks about "Liverpool's games" — league,
  cups, Europe, and preseason — while keeping the fan-out to a fixed, known
  list you can reason about and cache per league.
- `(A)` is the cheapest real improvement and directly fixes the "even
  friendlies" complaint, but a Champions League night would still be invisible
  on the Teams screen, which is likely to read as the same bug returning.
- `(B)` sounds better but means calling ~12 soccer league endpoints per team,
  most returning nothing; the wasted calls hurt the budget you just tightened
  in Spec 12.
- `(D)` is only right if you consider cups/Europe out of scope for this spec —
  say so and I will write it as an explicit non-goal.

---

## 3. Performance budget for the extra ESPN calls

Spec 12 wrapped these calls in `unstable_cache` with `revalidate: 300`. How should
the added fan-out be constrained?

- [ ] (A) Reuse the existing 300s `unstable_cache` wrapper per (leagueKey, teamId, season) and accept the extra cold-start latency
- [ ] (B) Same as (A), but also set an explicit budget in the spec (e.g. Teams p95 must not regress more than 20% vs the Spec 12 baseline) and prove it with a before/after measurement
- [ ] (C) Migrate this path to the Next.js 16 `use cache` directive as part of this spec
- [ ] (D) No caching constraint — correctness first, measure later
- [ ] (E) Other (describe)

**Current best-practice context:** Next.js 16 documents `unstable_cache` as
replaced by the `use cache` directive and recommends opting into Cache
Components (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md`).
Spec 12 already recorded a cache-migration evaluation, so this spec should
defer to that decision rather than re-open it.

**Recommended answer(s):** [(B)]

**Why these are recommended:**

- `(B)` keeps the Spec 12 investment honest: this spec measurably adds requests,
  so it should carry a stated budget and a before/after proof artifact, exactly
  like Spec 12 did.
- `(A)` is fine mechanically but leaves the regression unmeasured, which is how
  performance work quietly unwinds.
- `(C)` mixes a framework migration into a bug fix; if the Spec 12 evaluation
  already recommended migrating, that deserves its own spec.
- `(D)` risks shipping a Teams screen that is correct but noticeably slower.

---

## 4. Which screen gets the score-card redesign?

- [ ] (A) The `/teams` list screen only — replace the `EntityCard` scoreline rows with home-style `MatchCard`s
- [ ] (B) The `/teams/[favoriteId]` detail screen only
- [ ] (C) Both screens
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` matches the symptom you described: the plain scoreline ("Last · vs
  Brentford · 2-1") only exists on the `/teams` list screen.
- `(B)` is almost certainly already done — the detail screen renders the same
  `MatchCard` / `TennisMatchCard` components Home uses, added in Spec 11. If it
  looks wrong to you there, tell me what you are seeing and I will treat that
  as a third bug.
- `(C)` would only make sense if the detail screen also needs changes.

---

## 5. Teams list layout with the larger cards

A `MatchCard` is roughly 3x the height of the current scoreline row. With last +
next per team, a user following 6 teams goes from ~6 screens-worth to ~18.

- [ ] (A) Per team: header (crest + name) followed by a last-match card and a next-match card, stacked; grid collapses to a single column
- [ ] (B) Per team: header plus **one** card — the next match if there is one, otherwise the most recent completed match — with the full history one tap away on the detail screen
- [ ] (C) Per team: header plus last + next cards, but the section is collapsible and remembers its state
- [ ] (D) Drop the per-team grouping entirely — one flat chronological feed of all followed teams' matches, like Home
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is the most literal reading of your request ("takes up more space, but
  easier to read") and preserves the existing last/next information model, so
  nothing is lost.
- `(B)` keeps the screen short but silently removes information users have
  today; choose it if scroll length is your bigger concern.
- `(C)` adds state persistence (localStorage or a preference row) that is real
  extra scope for a spec that is already two-part.
- `(D)` duplicates Home and erases the per-team organisation that gives `/teams`
  its purpose.

---

## 6. Where the new competitions surface in the UI

Once cups and friendlies are included, a "last match" may be a friendly rather
than a league game.

- [ ] (A) Show whatever is chronologically most recent, and surface the competition name in the card footer so a friendly is visibly a friendly
- [ ] (B) Prefer competitive matches; only fall back to a friendly when there is no competitive match in range
- [ ] (C) Show the competition name and add a filter control to include/exclude friendlies
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is what a fan expects from "most recent game" and needs no new controls;
  `MatchCard`'s footer already renders a `round` / competition line, so the
  labelling is close to free.
- `(B)` introduces a ranking rule that will confuse users in preseason, when the
  friendly *is* the news.
- `(C)` is a reasonable follow-up but adds filter state and persistence to this
  spec's surface area.

---

## 7. Scope of the season fix across sports

- [ ] (A) Apply the season fallback generically in `teamScheduleForLeague` so every sport benefits
- [ ] (B) Apply it only to soccer, where the bug was observed
- [ ] (C) Apply generically, and additionally verify with one non-soccer team (e.g. an NFL or NBA favorite) as a proof artifact
- [ ] (D) Other (describe)

**Recommended answer(s):** [(C)]

**Why these are recommended:**

- The bug is a property of the shared ESPN endpoint, not of soccer, so a
  soccer-only fix `(B)` guarantees the same ticket reappears in the NFL or NBA
  offseason.
- `(C)` is `(A)` plus evidence, which is what makes the fix demonstrable in the
  SDD validation step rather than merely plausible.

---

## 8. Proof artifacts

Which evidence should this spec require before it is considered done?

- [ ] (A) Screenshot of `/teams` showing Liverpool with recent league matches, a friendly, and an upcoming fixture as full score cards
- [ ] (B) Unit tests over the season-fallback and multi-competition merge logic, using recorded ESPN fixtures (no live network in CI)
- [ ] (C) A `curl`/script transcript showing the before (0 events) and after (N events) ESPN responses for Liverpool
- [ ] (D) Before/after `Server-Timing` measurements for `/api/teams` proving the perf budget from Q3 holds
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A), (B), (D)]

**Why these are recommended:**

- `(A)` is the only artifact that proves the user-visible complaint is actually
  resolved, and it doubles as proof of the redesign.
- `(B)` is the artifact that stops the bug regressing; recorded fixtures keep CI
  hermetic, matching the repo's existing Vitest conventions.
- `(D)` pairs with the Q3 budget — without it the budget is an aspiration.
- `(C)` is useful diagnosis (it is how I found the bug) but it proves something
  about ESPN, not about our code, so it is optional colour rather than a gate.

---

## 9. Anything else

Any constraints, preferences, or context I have not asked about? (e.g. deadline,
whether `club.friendly` should be added to the committed team catalog, whether
tennis/player favorites are in or out of scope for the redesign.)

