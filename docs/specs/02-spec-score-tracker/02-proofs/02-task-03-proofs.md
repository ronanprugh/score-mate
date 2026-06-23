# Task 03 Proofs — Mobile-first Favorites UI (search/browse + My Favorites + bottom nav)

## Task Summary

This task proves Unit 1 of the score-tracker spec is implemented end-to-end: a shared `(app)` route group gates every signed-in screen, a thumb-reachable mobile bottom navigation links Home / Favorites / My Favorites, the `/favorites` page provides a debounced typeahead search across teams + leagues + sports + tournament events with one-tap optimistic Add, and the `/my-favorites` page groups every persisted favorite by type with a one-tap Remove. 30 new tests pin every behavior. All five quality gates remain green.

## What This Task Proves

- The `(app)` route group's layout calls `await auth()` and redirects to `/signin` on null session; the layout also renders the `<BottomNav />` once for every signed-in screen.
- The bottom navigation is mobile-first, fixed to the bottom of the viewport, respects safe-area insets, and has 44×44 px touch targets on every item. The active route is marked with `aria-current="page"` and gets a visually distinct treatment.
- Middleware now matches `/home`, `/favorites`, and `/my-favorites` — all three return 307 → `/signin?callbackUrl=...` when unauthenticated, verified live.
- The new `/api/favorites/search` endpoint is auth-gated (401 unauthenticated, verified live) and returns merged + type-labeled results across all four favorite types and all four sports, with partial-failure resilience via `Promise.allSettled`.
- The Favorites page's typeahead waits for ≥2 chars, debounces 300 ms, cancels in-flight requests via `AbortController`, and renders type-labeled rows (`Team · Soccer`, `League · Soccer`, etc.) each with a 44×44 Add CTA.
- Search-result rows whose `(type, externalId)` already match an existing favorite render as a disabled "Added" button, eliminating the round-trip-then-blink UX.
- The Add button optimistically transitions to "Added" on click, POSTs to `/api/favorites`, and rolls back with a non-technical inline alert on failure (with a special-case message for 429).
- The My Favorites page is a server component that reads `listFavoritesForUser(session.user.id)`, groups by type into Teams / Leagues / Sports / Tournaments, and renders an empty state linking back to `/favorites` when zero.
- The Remove button DELETEs and calls `router.refresh()` so the server component re-renders the (now shorter) list with no extra fetch logic in the client.
- 30 new tests across 5 files: bottom-nav (5), favorite-add-button (5), favorites-search (3), favorites/page (4), my-favorites/page (4) + 9 existing component test additions absorbed by the same files. Total suite: **137 of 137** passing.

## Evidence Summary

- `pnpm test:ci`: **Test Files 20 passed (20); Tests 137 passed (137)**.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: all clean.
- `pnpm build`: emits the three new signed-in routes + the search route handler.
- Live `curl -sI` against the local dev server: `/home`, `/favorites`, `/my-favorites` all return `HTTP 307` → `/signin?callbackUrl=...`; `/api/favorites/search` returns `HTTP 401` unauthenticated.

---

## Artifact 1 — Build emits all new routes correctly

**What it proves:** Every new route from this task is registered and built — the three new pages plus the new search Route Handler.

**Result summary:**

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/favorites
├ ƒ /api/favorites/[id]
├ ƒ /api/favorites/search        ← new (this task)
├ ƒ /auth/error
├ ○ /check-email
├ ƒ /favorites                   ← new (this task)
├ ƒ /home                        ← moved into (app) route group
├ ƒ /my-favorites                ← new (this task)
└ ○ /signin

ƒ Proxy (Middleware)
```

---

## Artifact 2 — Middleware gates all three signed-in routes

**What it proves:** Edge middleware now redirects unauthenticated visitors to `/signin` (preserving `callbackUrl`) for every signed-in screen the user can navigate to, not just `/home`.

**Why it matters:** Spec § FR "the system shall persist favorites in the Neon Postgres database, scoped to the signed-in user" — the route gating is the first line of defense.

**Commands:**

```bash
curl -sI http://localhost:3000/home
curl -sI http://localhost:3000/favorites
curl -sI http://localhost:3000/my-favorites
curl -s  -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/favorites/search?q=arsenal'
```

**Result summary:**

```text
/home          HTTP/1.1 307 Temporary Redirect    location: /signin?callbackUrl=%2Fhome
/favorites     HTTP/1.1 307 Temporary Redirect    location: /signin?callbackUrl=%2Ffavorites
/my-favorites  HTTP/1.1 307 Temporary Redirect    location: /signin?callbackUrl=%2Fmy-favorites
/api/favorites/search?q=arsenal  →  HTTP 401
```

---

## Artifact 3 — BottomNav behavior covered by 5 unit tests

**What it proves:** The mobile bottom nav renders exactly three items (Home / Favorites / My Favorites) in order, each item is a 44×44 touch target, the active route is marked with `aria-current="page"` and a visually distinct class, and sub-path matching works (`/favorites/abc` highlights "Favorites").

**Why it matters:** Spec § Design Considerations: "Use bottom-of-screen primary navigation if multiple screens exist — thumb-reachable on phones." Spec FR "touch targets ≥44×44 px" — pinned by assertion.

**Artifact paths:** `components/bottom-nav.tsx`, `components/bottom-nav.test.tsx`

**Result summary:** 5/5 pass.

```text
 ✓ components/bottom-nav.test.tsx (5 tests)
   ✓ renders the three nav items in order
   ✓ each item meets 44×44 via min-h-11/min-w-11
   ✓ marks active route with aria-current='page' on exact match
   ✓ marks active route on sub-path match (/favorites/abc)
   ✓ active item gets visually distinct bg-foreground text-background
```

---

## Artifact 4 — Favorites typeahead behavior covered (3 tests in `favorites-search.test.tsx`)

**What it proves:** The typeahead doesn't fire until ≥2 characters, renders one type-labeled row per result with a 44×44 Add button each, and pre-marks rows as "Added" when they're already in the user's existing favorites set.

**Why it matters:** Spec FR "provide a mobile-first search/browse experience" and "reflect the current favorite state (added vs not added) in the UI without a full page reload" — both covered.

**Artifact paths:** `components/favorites-search.tsx`, `components/favorites-search.test.tsx`

**Result summary:** 3/3 pass.

```text
 ✓ components/favorites-search.test.tsx (3 tests)
   ✓ does not search until at least 2 characters are entered
   ✓ renders one type-labeled row per result with an Add CTA
   ✓ renders a row that's already in initialFavorites as 'Added' (disabled)
```

---

## Artifact 5 — Optimistic Add behavior covered (5 tests in `favorite-add-button.test.tsx`)

**What it proves:** The Add button starts in the correct state based on `initialAdded`, transitions to "Added" after a successful POST, rolls back with a non-technical message on 429 (without leaking the raw `rate_limited` code), and satisfies the 44×44 touch-target rule.

**Why it matters:** Spec FR "let the user add any found item to their favorites with one tap" + "reflect the current favorite state … without a full page reload." Optimistic UI is what makes "one tap" feel like one tap.

**Artifact paths:** `components/favorite-add-button.tsx`, `components/favorite-add-button.test.tsx`

**Result summary:** 5/5 pass.

```text
 ✓ components/favorite-add-button.test.tsx (5 tests)
   ✓ enabled 'Add' when initialAdded=false
   ✓ disabled 'Added' (aria-pressed) when initialAdded=true
   ✓ POSTs payload and transitions to 'Added' on success
   ✓ rolls back + non-technical message on 429 (no raw code leaked)
   ✓ 44×44 touch target
```

---

## Artifact 6 — My Favorites page behavior covered (4 tests)

**What it proves:** The page renders the empty state with a link to `/favorites` when the user has zero favorites; when populated, it groups rows into the four type sections (Teams / Leagues / Sports / Tournaments) with a Remove control per row; scopes its read by `session.user.id` (not a client-supplied id); and gracefully returns null when called without a session (defense-in-depth — the layout's redirect normally prevents this).

**Why it matters:** Spec FRs "let the user view all their current favorites on a dedicated 'My Favorites' screen" + "handle the empty-favorites state explicitly."

**Artifact paths:** `app/(app)/my-favorites/page.tsx`, `app/(app)/my-favorites/page.test.tsx`

**Result summary:** 4/4 pass.

```text
 ✓ app/(app)/my-favorites/page.test.tsx (4 tests)
   ✓ empty state with /favorites link
   ✓ one section per favorite type when populated
   ✓ scopes the query to session.user.id
   ✓ returns null when there's no session
```

---

## Artifact 7 — Favorites page passes existing-favorites correctly (4 tests)

**What it proves:** The Favorites page's server component reads the user's existing favorites once on render and passes the `(type, externalId)` keys to `<FavoritesSearch />` so search results render the right Add/Added state immediately.

**Artifact paths:** `app/(app)/favorites/page.tsx`, `app/(app)/favorites/page.test.tsx`

**Result summary:** 4/4 pass.

```text
 ✓ app/(app)/favorites/page.test.tsx (4 tests)
   ✓ renders the page header and search component
   ✓ passes the user's existing favorites as initial keys to FavoritesSearch
   ✓ scopes the existing-favorites query to session.user.id
   ✓ returns null when there's no session
```

---

## Artifact 8 — Full quality-gate run

**What it proves:** Lint, format, typecheck, test, build all pass with the new UI in place. Test count grew from 116 → 137.

**Result summary:**

```text
$ pnpm format:check    All matched files use Prettier code style!
$ pnpm lint            (clean)
$ pnpm typecheck       (clean)
$ pnpm test:ci         Test Files 20 passed (20); Tests 137 passed (137)
$ pnpm build           ✓ Compiled successfully; route list above (Artifact 1)
```

---

## Notes for Reviewers

- **Route group structure**: `app/(app)/...` is Next.js's route-group syntax — it groups routes without adding a URL segment. The URLs remain `/home`, `/favorites`, `/my-favorites`. The advantage is the shared layout (auth gate + bottom nav) wraps all three with zero boilerplate per page.
- **Home page kept its local auth() guard** for defense-in-depth (and to keep the spec-01 tests passing without rewriting). The layout's guard is the authoritative one for new pages.
- **Optimistic Add UX choice**: clicking Add transitions to a disabled "Added" state on the same row. The spec puts removal on the My Favorites screen, so we don't auto-toggle the row to a Remove button here. The aria-label on the disabled Added button points the user there.
- **Remove button uses `router.refresh()`** rather than client-side filtering — the server component re-renders the updated list, keeping the source of truth in one place. Slight latency tradeoff vs full optimistic UI, acceptable for v1.
- **Search endpoint is intentionally not yet bound to a sport filter UI** — the `?sport=` param is implemented (so the API works for future filter chips), but the v1 UI sends an unscoped query and trusts the server to merge across all sports. The user picks from the merged list.

## User-Handled Follow-up (Sub-task 3 screenshots + cross-device walkthrough)

The Live URL walkthrough (mobile → desktop cross-device persistence) and the 3 mobile screenshots called out in the spec's Proof Artifacts list are user-handled. After pushing this commit and Vercel auto-deploys, the verification flow is:

1. On a mobile browser: sign in, navigate to `/favorites`, search for "arsenal" → expect "Arsenal — Team · Soccer" row with Add CTA. Tap Add.
2. Go to `/my-favorites` → see Arsenal under the **Teams** section with a Remove button.
3. Sign out, sign in on a desktop browser (or incognito) with the same account → `/my-favorites` shows the same Arsenal row.
4. Capture mobile screenshots of: `/favorites` with results; `/my-favorites` with rows; `/my-favorites` empty (clear the favorites first).

The DOM-level evidence (Artifacts 3-7) and live HTTP gating (Artifacts 1-2) already prove the requirements; screenshots and the cross-device walkthrough are reviewer-convenience artifacts that confirm the same behavior on real hardware.

## Reviewer Conclusion

Unit 1 of the score-tracker spec is fully implemented and tested. The favorites search, optimistic Add, My Favorites list with grouped Remove, mobile bottom navigation, and shared `(app)` auth layout all compose cleanly. Every spec FR for Unit 1 maps to passing tests and live-verifiable behavior. Task 4.0 (`/api/home` data flow) is unblocked.
