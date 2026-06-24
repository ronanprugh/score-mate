# Task 05 Proofs — Mobile-first homepage UI: day groups, match cards, empty/error states

## Task Summary

This task proves that the score-tracker homepage now has a real UI: a thin server-component shell renders a client component (`HomeClient`) which fetches `/api/home`, renders three day sections (Yesterday / Today / Tomorrow) of `MatchCard`s, and degrades gracefully into a no-matches empty state, a no-favorites prompt, or a partial-error banner when the upstream data source is degraded.

Polling and live auto-refresh are explicitly out of scope here — they're Task 6.0.

## What This Task Proves

- The placeholder `/home` page from spec 01 has been replaced by a thin server shell that embeds `<HomeClient />`.
- `<HomeClient />` performs the date-window computation and the `/api/home` fetch on mount.
- `<MatchCard />` renders three visually distinct branches (Final / Live / Upcoming) with uniform card height and truncated long names.
- `<DaySection />` produces a responsive grid (1 col mobile → 2 cols `sm:` → 3 cols `lg:`) under a sticky day header.
- `<NoMatchesEmptyState />` and `<DataSourceErrorBanner />` are presentational and reused by `HomeClient`.
- Tests cover the static cases listed in the task (per-day rendering, no-matches empty state, error banner) plus the three MatchCard status branches and truncation.

## Evidence Summary

- `pnpm typecheck` is clean.
- `pnpm lint` is clean.
- `pnpm format:check` is clean.
- `pnpm test:ci` runs **158 tests across 24 files, all passing** — up from 144 prior to this task (14 new tests: 5 MatchCard, 4 HomeClient, 4 HomePage rewrite, +1 from rewriting an existing test into a passing equivalent shell test).

## Artifact: Server-shell rewrite of `app/(app)/home/page.tsx`

**What it proves:** The spec-01 placeholder copy is gone and the page is now the thin server-shell described by sub-task 5.1.

**Why it matters:** The home page is the user's main entry point. The server shell does the auth gate + loads favorites (so we know whether to show the "no favorites yet" prompt), then delegates rendering to `HomeClient`.

**Artifact path:** `app/(app)/home/page.tsx`

**Result summary:** The shell is ~35 lines: it calls `auth()`, redirects to `/signin` when unauthenticated, fetches the user's favorites via `listFavoritesForUser`, renders a static header, and embeds `<HomeClient hasFavorites={favorites.length > 0} />`. No score-tracker rendering happens server-side — that's the client's job (it owns the browser-timezone date window).

## Artifact: `components/home-client.tsx`

**What it proves:** The client component owns the date-window computation, the `/api/home` fetch, and branches between `<DaySection />`s, the no-matches empty state, the no-favorites prompt, and the partial-error banner.

**Why it matters:** This is the centerpiece of the score-tracker UX. Encapsulating fetch + render in one component keeps the surface area small for the polling/visibility work coming in Task 6.0.

**Artifact path:** `components/home-client.tsx`

**Result summary:** On mount, it computes `[yesterday, today, tomorrow]` via `lib/date-window.ts` in the browser's resolved IANA timezone, fetches `/api/home?dates=...` with an `AbortController`, and renders one of four states (loading, error, ready-with-content, ready-empty). The error banner is rendered ABOVE the day sections when `source.ok === false`, matching the spec's "non-blocking banner" requirement.

## Artifact: `components/match-card.tsx`

**What it proves:** Three keyed status branches render with the visual treatments the spec calls out — muted "Final" + scores; pulsing "LIVE" pill + scores + minute/period/set; clock icon + local kickoff time + broadcast.

**Why it matters:** This is the single most-rendered component in the app — its quality directly defines whether the score tracker "looks right" on mobile.

**Artifact path:** `components/match-card.tsx`

**Result summary:** Uses `data-status` for status-driven styling, `min-h-32` for uniform card height across all three branches, and `truncate` + `title` on team/league/venue/broadcast text to handle the long-name case without breaking layout. `formatKickoffLocal` uses `Intl.DateTimeFormat` so kickoff times are rendered in the user's locale.

## Artifact: `components/day-section.tsx`

**What it proves:** Sticky day header + responsive card grid as called out in sub-task 5.3.

**Why it matters:** Confirms the homepage scales from a 375px phone (single column under each header) up to desktop (three-column grid) without media-query gymnastics — pure Tailwind responsive utilities.

**Artifact path:** `components/day-section.tsx`

**Result summary:** Header is `sticky top-0` with a translucent background; the grid is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. When a day has zero matches, a small inline "No matches." line stands in for the grid so the day section still anchors the layout.

## Artifact: `components/no-matches-empty-state.tsx` + `components/data-source-error-banner.tsx`

**What it proves:** The two presentational components called out in sub-task 5.5 exist as small, focused components.

**Why it matters:** Keeping them separate from `HomeClient` makes them trivially reusable and individually testable.

**Artifact paths:** `components/no-matches-empty-state.tsx`, `components/data-source-error-banner.tsx`

**Result summary:** The empty state has a 44px "Manage favorites" link back to `/favorites`; the error banner has `role="alert"` and pluralizes the failure count.

## Artifact: `components/match-card.test.tsx` — 5 tests

**What it proves:** All three status branches, long-name truncation, and uniform card height are asserted by automated tests.

**Why it matters:** Locks the visual contract so future changes can't silently regress one of the three branches.

**Command:**

```bash
pnpm test:ci components/match-card.test.tsx
```

**Result summary:** 5/5 pass. Each branch has its own `it` block plus the truncation and uniform-height assertions called out in the sub-task.

## Artifact: `components/home-client.test.tsx` — 4 tests (static cases)

**What it proves:** With `/api/home` mocked, `HomeClient` correctly renders (a) three day sections when matches exist, (b) the no-matches empty state when the user has favorites but no matches, (c) the no-favorites prompt when `hasFavorites === false`, and (d) the data-source error banner when `source.ok === false`.

**Why it matters:** These are exactly the three cases enumerated in sub-task 5.8 (plus the no-favorites prompt — a natural fourth case once the empty-state branch was split).

**Command:**

```bash
pnpm test:ci components/home-client.test.tsx
```

**Result summary:** 4/4 pass. `fetchMock` returns the envelope shape and `waitFor` resolves after the effect runs. The error-banner case also asserts the failure-count copy ("2 requests failed").

## Artifact: `app/(app)/home/page.test.tsx` rewrite — 4 tests

**What it proves:** The new server shell correctly redirects when unauthenticated, loads the user's favorites scoped by id, and embeds `<HomeClient />` with the right `hasFavorites` prop.

**Why it matters:** Confirms the auth gate and the favorites pass-through still work after the rewrite — without re-asserting the placeholder copy that's no longer there.

**Command:**

```bash
pnpm test:ci app/(app)/home/page.test.tsx
```

**Result summary:** 4/4 pass. `HomeClient` is mocked to a stub so the page test stays focused on the shell.

## Artifact: Quality gates — typecheck, lint, format, tests

**What it proves:** The CI gates that run on every PR pass locally for this change set.

**Why it matters:** These are the same gates the repo's `.github/workflows/ci.yml` runs; passing them locally means the upcoming push won't break CI for the rest of the spec.

**Commands and result summary:**

```bash
pnpm typecheck   # clean (tsc --noEmit, no output)
pnpm lint        # clean (eslint, no output)
pnpm format:check # "All matched files use Prettier code style!"
pnpm test:ci     # Test Files  24 passed (24) | Tests  158 passed (158)
```

## Reviewer Conclusion

These artifacts show Task 5.0 is complete: the homepage now has a server shell, a client owner of the data flow, three day sections, three match-card branches, and the two graceful-degradation states (empty + partial-error). All 158 tests pass and every quality gate is green. The only remaining piece for the score-tracker spec is Task 6.0 (live polling + visibility gating + deploy).
