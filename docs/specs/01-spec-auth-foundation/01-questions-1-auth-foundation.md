# 01 Questions Round 1 - Score Tracker

Please answer each question below (check one or more options, or add notes under "Other"). These answers will shape the spec.

---

## 1. Sports Data Source

Where will scores, schedules, and team/league/event metadata come from? This is the single most architecturally consequential choice.

- [X] (A) **TheSportsDB** — free, no API key for basic tier, covers many sports/leagues globally; data freshness varies; community-maintained.
- [ ] (B) **ESPN's undocumented public endpoints** (e.g., `site.api.espn.com`) — broad coverage, frequently updated, but unofficial and could break without notice.
- [ ] (C) **API-Football / API-Sports** (RapidAPI) — paid tiers with generous free quota; strong soccer coverage, growing to other sports; requires API key.
- [ ] (D) **SportRadar / official paid APIs** — production-grade, expensive, requires contracts; overkill for v1.
- [ ] (E) Other (describe)

**Current best-practice context:** For hobby/MVP web apps, hobbyists commonly start with TheSportsDB or ESPN's unofficial endpoints to avoid keys and cost. Production-grade apps move to paid APIs once usage justifies it. ESPN's endpoints are reverse-engineered and have no SLA.

**Recommended answer(s):** [(A) TheSportsDB], with (B) ESPN as a documented fallback only if a sport is missing.

**Why these are recommended:**
- TheSportsDB requires no signup for v1 and covers Team USA, soccer, and the World Cup — directly matching the examples you gave.
- ESPN endpoints are tempting but unofficial; relying on them as the primary source creates ambient breakage risk.
- Paid APIs add operational overhead (keys, secrets, billing) that isn't justified for v1.

---

## 2. User Accounts & Persistence

How are favorites stored? This determines whether you need auth, a backend database, or just the browser.

- [ ] (A) **Local-only (browser localStorage)** — no accounts, no backend, favorites live on one device.
- [ ] (B) **Single-user, server-persisted** — one hardcoded user (you), favorites saved to a backend DB; no login UI.
- [X] (C) **Multi-user with auth** — sign-up/sign-in, each user has their own favorites (email/password, magic link, or OAuth).
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A) Local-only] for v1.

**Why these are recommended:**
- (A) is the smallest end-to-end slice that delivers the feature you described — no auth UX, no DB ops, no secret management.
- (C) is a meaningful product step but doubles the scope of v1; better as a follow-on spec.
- If you ever want cross-device sync, you can layer (B) or (C) on later without throwing away (A).

---

## 3. "Favorite" Target Types & Semantics

You mentioned three kinds of favorites: team, sport, event. How should each behave?

- [X] (A) **Team** (e.g., "Team USA Men's Soccer") → show matches involving that team.
- [] (B) **Sport** (e.g., "Soccer") → show *all* matches in that sport (likely overwhelming).
- [X] (C) **Sport, scoped to top matches only** (e.g., "Soccer" → Premier League, La Liga, Champions League, MLS, international tournaments) — curated set.
MAKE A CHANGE TO C - let's scope it to top matches (a.k.a, matches that most people will care about)
- [X] (D) **League** (e.g., "Premier League") → show all matches in that league.
- [X] (E) **Event/Tournament** (e.g., "World Cup 2026") → show matches in that specific tournament instance.
- [ ] (F) **Event series** (e.g., "World Cup" recurring) → automatically follow the next/current instance.
- [ ] (G) Other (describe)

**Recommended answer(s):** [(A), (C), (D), (E)] — drop pure "Sport" in favor of "Sport scoped to top leagues" to avoid 200-match days. <user>I answered, but I changed answer C</user>

**Why these are recommended:**
- (B) "all soccer matches today" would produce noise that defeats the score-tracker purpose.
- (C) preserves the spirit of "favorite Soccer" while keeping the homepage useful.
- (F) is appealing but adds calendar logic ("which World Cup instance is current?") that's worth deferring to v2.

---

## 4. Sports & Leagues Covered in v1

How wide should the v1 catalog be?

- [ ] (A) **Soccer only** (international + top European leagues + MLS) — narrowest, fastest to ship.
- [ ] (B) **Soccer + 1-2 more** (e.g., NFL, NBA) — moderate.
- [ ] (C) **All major US sports + international soccer** (NFL, NBA, MLB, NHL, MLS, Premier League, Champions League, World Cup, Olympics).
- [ ] (D) **Everything TheSportsDB offers** — broadest, most unpredictable data quality.
- [X] (E) Other (describe) <user>Tennis, Basketball (United States Professional and College), American Football, Soccer (from A)</user>

**Recommended answer(s):** [(C)].

**Why these are recommended:**
- Matches the examples you gave (Team USA, Soccer, World Cup) which span US sports + international.
- Bounded enough to test thoroughly; broad enough to feel useful day-to-day.
- (A) feels too narrow given you mentioned Team USA; (D) makes QA impossible.

---

## 5. Homepage Date Window & Timezone

You said "today, yesterday, or tomorrow." How should those days be computed?

- [X] (A) **User's local browser timezone** — `yesterday/today/tomorrow` are based on the device's clock.
- [ ] (B) **Fixed timezone** (e.g., America/Los_Angeles or UTC).
- [ ] (C) **User-selectable timezone in settings** — defaults to browser, overridable.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A) browser local].

**Why these are recommended:**
- Matches user expectation — "today" means today *here*.
- No settings UI required for v1.
- (C) is a nice v2 enhancement; not load-bearing now.

---

## 6. Live Score Updates

When a match is in progress, should the score update without a page refresh?

- [ ] (A) **Refresh on page load only** — simplest; user reloads to see updates.
- [X] (B) **Auto-refresh on a timer** (e.g., every 60s) while the page is open.
- [ ] (C) **Real-time push** (WebSocket / Server-Sent Events) — most complex.
- [ ] (D) Other (describe)

**Recommended answer(s):** [(B) auto-refresh every 60s, but only when at least one tracked match is currently "in progress"].

**Why these are recommended:**
- (A) feels stale during a live match — undermines the "score tracker" framing.
- (C) requires backend infrastructure most data sources don't even support.
- (B) with conditional polling is a small amount of code and a big UX win.

---

## 7. Tech Stack

What should this be built with?

- [X] (A) **Next.js (App Router) + TypeScript + Tailwind**, deployed on Vercel — modern default, great DX, serverless-friendly.
- [ ] (B) **Vite + React + TypeScript**, static-host (Netlify/Cloudflare Pages) — lighter, no SSR.
- [ ] (C) **SvelteKit** — leaner than React, less ecosystem.
- [ ] (D) **Plain HTML + vanilla JS** — minimal, no build step.
- [ ] (E) Other (describe)

**Current best-practice context:** Next.js + TS + Tailwind on Vercel is the prevailing default for new web apps in 2026; SSR/route handlers let you proxy the sports API server-side (avoiding CORS and hiding any keys you add later). For a purely local-favorites v1, Vite + React would also work and stays fully client-side.

**Recommended answer(s):** [(A) Next.js + TS + Tailwind on Vercel].

**Why these are recommended:**
- Server route handlers let you proxy TheSportsDB calls, which sidesteps CORS issues and gives you a clean place to add caching.
- Sets you up for (C) multi-user auth or paid-API keys later without a rewrite.
- Vercel free tier is sufficient for personal use.

---

## 8. Future Match Detail Level

For matches "played tomorrow," what details should be shown beyond start time?

- [ ] (A) **Time + teams + venue** — minimal.
- [ ] (B) (A) + **competition name + round/matchweek**.
- [X] (C) (B) + **broadcast channel / streaming info** (if data source provides).
- [ ] (D) (B) + **head-to-head recent form** (last 5 results).
- [ ] (E) Other (describe)

**Recommended answer(s):** [(B)].

**Why these are recommended:**
- Gives enough context to know *why* the match matters without bloating the card.
- (C) depends on data availability (TheSportsDB has it spottily); defer.
- (D) is an interesting v2 enhancement.

---

## 9. Proof Artifacts (How will we demo this works?)

What should serve as the evidence that the feature works end-to-end?

- [X] (A) **Screenshots** of the homepage with seeded favorites showing yesterday/today/tomorrow matches.
- [X] (B) **Live deployed URL** (Vercel preview) reviewer can click through.
- [ ] (C) **Recorded screen capture** of the favoriting flow + homepage refresh.
- [ ] (D) **Automated E2E tests** (Playwright) that drive the UI and assert the result.
- [ ] (E) All of the above.
- [ ] (F) Other (describe)

**Recommended answer(s):** [(A) + (B)] for v1; defer (D) to a testing-strategy follow-on.

**Why these are recommended:**
- Screenshots + a live URL is the lightest credible proof for a personal-use web app.
- Playwright is great but adds setup cost that isn't justified until the feature stabilizes.

---

Once you've filled this in (just edit the checkboxes and add notes), tell me you're done and I'll read the file and continue.
