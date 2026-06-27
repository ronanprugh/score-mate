# 07-tasks-navigation-restructure.md

Implementation task list for [07-spec-navigation-restructure.md](./07-spec-navigation-restructure.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `components/favorites-list.tsx` | NEW. Extracted saved-favorites grouped list (Teams/Leagues/Sports/Tournaments) + empty state, taking `favorites: FavoriteRow[]`. Moves the rendering currently in `my-favorites/page.tsx`; reuses `FavoriteRemoveButton`. |
| `components/favorites-list.test.tsx` | NEW. Unit tests: grouping, hidden empty types, remove buttons, empty state. |
| `app/(app)/favorites/page.tsx` | MODIFY. Unified page: keep `FavoritesSearch` add section, render `<FavoritesList>` (saved list) below it. Load favorites once and feed both. |
| `app/(app)/favorites/page.test.tsx` | MODIFY. Assert both the add section and the saved groups render; assert the empty state. |
| `app/(app)/my-favorites/page.tsx` | MODIFY. Replace body with `redirect("/favorites")`. |
| `app/(app)/my-favorites/page.test.tsx` | MODIFY. Assert it redirects to `/favorites`. |
| `app/(app)/settings/page.tsx` | NEW. Authenticated Settings page surfacing `AccountMenu` (identity + Sign out) + an app-info line. |
| `app/(app)/settings/page.test.tsx` | NEW. Assert identity + Sign-out control + app-info line render. |
| `components/account-menu.tsx` | MODIFY (styling only, if needed). Reused on Settings; keep the Auth.js `signOut` server action unchanged. |
| `components/nav-icons.tsx` | NEW. Three inline SVG icon components (Home, Favorites, Settings), outline, `aria-hidden`. |
| `components/bottom-nav.tsx` | MODIFY. Three icon+label destinations (Home/Favorites/Settings); remove "My Favorites"; keep active-state, `aria-current`, prefix matching, `min-h-11`, safe-area. |
| `components/bottom-nav.test.tsx` | MODIFY. Assert 3 items, icons + labels, hrefs, active + `aria-current`, prefix match, touch targets. |
| `app/(app)/layout.tsx` | MODIFY (comment only). Update the doc-comment that lists "Home / Favorites / My Favorites". |
| `app/dev-fixture/nav/page.tsx` | NEW (dev-only). Renders `FavoritesList`, `AccountMenu` (placeholder email), and `BottomNav` for screenshot capture. MUST stay unlinked from `BottomNav` and any production route (Spec 05/06 fixture convention). |
| `docs/specs/07-spec-navigation-restructure/07-proofs/` | NEW. Evidence bundle (screenshots, CI transcript, touched-files list, proof index, task proof markdowns). |

### Notes

- Tests are colocated next to their source files per `AGENTS.md`.
- Run `pnpm test:ci` locally; CI runs `lint → format:check → typecheck → test:ci → build`.
- All commits use Conventional Commits with `Related to T#.# in Spec 07-spec-navigation-restructure` in the body.
- No new runtime dependencies (icons are inline SVG). No DB migration. No change to favorites add/remove/validate/query logic.
- Auth-gated pages can't be screenshotted without a session; use the dev-only fixture route (`/dev-fixture/nav`) + headless render, redacting any email.

## Tasks

### [x] 1.0 Unified Favorites page

Maps Spec Unit 1. Merge the search/add screen and the saved-favorites list into a single `/favorites` page (add section on top, grouped saved list below), and redirect `/my-favorites` → `/favorites` so existing links don't break. No change to favorites add/remove/validate/query logic or DB schema. Commits with body `Related to T1.0 in Spec 07-spec-navigation-restructure`.

#### 1.0 Proof Artifact(s)

- Test: `app/(app)/favorites/page.test.tsx` asserts the unified page renders both the `FavoritesSearch` add section and the saved-favorites groups (Teams/Leagues/Sports/Tournaments) for a user with favorites, demonstrates the merge.
- Test: `app/(app)/my-favorites/page.test.tsx` asserts `/my-favorites` redirects to `/favorites`, demonstrates no broken links.
- Test: `components/favorites-list.test.tsx` asserts the saved section renders an empty state when the user has no favorites, demonstrates the empty path.
- Screenshot: `docs/specs/07-spec-navigation-restructure/07-proofs/07-favorites-unified.png` showing the add section above the grouped saved list, demonstrates the unified layout.

#### 1.0 Tasks

- [x] 1.1 Create `components/favorites-list.tsx`: move the grouped saved-list rendering out of `my-favorites/page.tsx` into a component taking `favorites: FavoriteRow[]` — reuse `SECTION_ORDER`/`SECTION_LABEL`/`groupByType` logic and `FavoriteRemoveButton`; render the "no favorites yet" empty state when the list is empty. No logic change.
- [x] 1.2 Create `components/favorites-list.test.tsx`: assert sections render only for present types, each row shows `displayName` + sport + a remove button, and the empty state renders for `[]`.
- [x] 1.3 Update `app/(app)/favorites/page.tsx`: load the user's favorites once; keep the `FavoritesSearch` add section under its heading, then render `<FavoritesList favorites={existing} />` below under a "Your favorites" heading. Pass `initialFavorites` to `FavoritesSearch` as today.
- [x] 1.4 Update `app/(app)/favorites/page.test.tsx`: assert the page renders the search/add control AND the saved groups for a user with favorites; assert the saved empty state when the user has none; assert the page still passes `initialFavorites` so `FavoritesSearch`'s "Added" state is preserved after the merge (regression guard).
- [x] 1.5 Replace `app/(app)/my-favorites/page.tsx` body with `redirect("/favorites")` (import from `next/navigation`); drop the now-unused grouping code.
- [x] 1.6 Update `app/(app)/my-favorites/page.test.tsx`: mock `next/navigation` `redirect` and assert it is called with `/favorites`.
- [x] 1.7 Capture `docs/specs/07-spec-navigation-restructure/07-proofs/07-favorites-unified.png` (dev-fixture render of the unified page / `FavoritesList` acceptable; redact any email). Note in the proof doc that the screenshot is a dev-fixture render and that authenticated-route behavior is covered by the route tests.
- [x] 1.8 Run `pnpm typecheck && pnpm test:ci`; commit `feat(nav): unified Favorites page + /my-favorites redirect` with body `Related to T1.0 in Spec 07-spec-navigation-restructure`.

### [ ] 2.0 Settings page with working sign-out

Maps Spec Unit 2. Add a `/settings` route in the authenticated `(app)` group that surfaces the user's signed-in identity and a working Sign-out action (reusing the existing `AccountMenu` / Auth.js `signOut` server action), plus a basic app-info line. Restores the currently-unreachable sign-out path. No account-management features. Commits with body `Related to T2.0 in Spec 07-spec-navigation-restructure`.

#### 2.0 Proof Artifact(s)

- Test: `app/(app)/settings/page.test.tsx` asserts the page renders the signed-in identity and a Sign-out control (a `form` wired to the sign-out action), demonstrates the restored account surface.
- Test: `app/(app)/settings/page.test.tsx` asserts the app-info line (app name / descriptor) is present, demonstrates the info section.
- Screenshot: `docs/specs/07-spec-navigation-restructure/07-proofs/07-settings.png` showing identity + Sign out (email redacted), demonstrates the Settings page.

#### 2.0 Tasks

- [ ] 2.1 Create `app/(app)/settings/page.tsx`: server component; call `auth()`, guard null session; render `<AccountMenu email={session.user.email} name={session.user.name} />` plus an app-info line (app name + one-line descriptor). Set `metadata.title` to `"Settings · ScoreMate"`. Use the existing page layout patterns (`max-w-md`, safe-area padding).
- [ ] 2.2 Adjust `components/account-menu.tsx` styling only if needed so it reads well as the primary Settings section; keep the `signOut` server action wiring unchanged.
- [ ] 2.3 Create `app/(app)/settings/page.test.tsx`: mock `auth()` to return a session; assert the display name/email render, a Sign-out `form`/button is present, and the app-info line is present.
- [ ] 2.4 Capture `docs/specs/07-spec-navigation-restructure/07-proofs/07-settings.png` (dev-fixture render of `AccountMenu` + app info acceptable; use a placeholder email). Note in the proof doc that it is a dev-fixture render and that authenticated-route behavior is covered by `settings/page.test.tsx`.
- [ ] 2.5 Run `pnpm typecheck && pnpm test:ci`; commit `feat(nav): settings page with sign-out` with body `Related to T2.0 in Spec 07-spec-navigation-restructure`.

### [ ] 3.0 Redesigned bottom navigation

Maps Spec Unit 3. Replace the three text-only nav items with three icon+label destinations — Home (`/home`), Favorites (`/favorites`), Settings (`/settings`) — using inline SVG icons (no new dependency). Remove the "My Favorites" item. Preserve active-state styling, `aria-current`, prefix-based active matching, ≥44px touch targets, and safe-area insets. Depends on T1.0 + T2.0. Commits with body `Related to T3.0 in Spec 07-spec-navigation-restructure`.

#### 3.0 Proof Artifact(s)

- Test: `components/bottom-nav.test.tsx` asserts exactly three items (Home, Favorites, Settings) with correct `href`s, an inline `svg` icon + text label each, active-state + `aria-current="page"` on the current route, and `min-h-11` touch targets, demonstrates the redesigned nav.
- Test: `components/bottom-nav.test.tsx` asserts a nested route (e.g. `/favorites/x`) still marks the Favorites tab active, demonstrates prefix matching is preserved.
- Screenshot: `docs/specs/07-spec-navigation-restructure/07-proofs/07-bottom-nav.png` showing the three icon+label destinations with one active, demonstrates the visual redesign.

#### 3.0 Tasks

- [ ] 3.1 Create `components/nav-icons.tsx`: three small inline-SVG icon components (Home, Favorites, Settings), outline style, `aria-hidden="true"`, sized ~20–24px, inheriting `currentColor`.
- [ ] 3.2 Update `components/bottom-nav.tsx`: set `NAV_ITEMS` to Home(`/home`)/Favorites(`/favorites`)/Settings(`/settings`) with an `icon` per item; render the icon above the label in a vertical stack; remove "My Favorites". Keep the `pathname === href || pathname.startsWith(href + "/")` active logic, `aria-current`, active styling, `min-h-11`/`min-w-11`, and safe-area insets.
- [ ] 3.3 Update `components/bottom-nav.test.tsx`: assert exactly 3 items with correct hrefs + labels, each renders an `svg`, the active item has `aria-current="page"` (mock `usePathname`), a nested `/favorites/x` path keeps Favorites active, and each item has `min-h-11`.
- [ ] 3.4 Update the `app/(app)/layout.tsx` doc-comment that lists "Home / Favorites / My Favorites" to reflect the new destinations (comment only; no behavior change).
- [ ] 3.5 Capture `docs/specs/07-spec-navigation-restructure/07-proofs/07-bottom-nav.png` (dev-fixture render of `BottomNav`).
- [ ] 3.6 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci`; commit `feat(nav): icon bottom nav — Home, Favorites, Settings` with body `Related to T3.0 in Spec 07-spec-navigation-restructure`.

### [ ] 4.0 Full CI gate verification + proof bundle

Maps Spec Success Metrics §4–§5. Run the complete CI gate suite, capture the transcript, verify no favorites-logic/schema/dependency changes, and assemble the proof bundle. Commits with body `Related to T4.0 in Spec 07-spec-navigation-restructure`.

#### 4.0 Proof Artifact(s)

- File: `docs/specs/07-spec-navigation-restructure/07-proofs/07-ci-gates.txt` — full transcript of `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`, all gates exit 0, demonstrates Success Metric §4.
- File: `docs/specs/07-spec-navigation-restructure/07-proofs/07-touched-files.txt` — `git diff --name-only` confirming changes are limited to nav/page UI (no `db/`, no `package.json` dependency change, no favorites add/remove/validate/query files), demonstrates Success Metric §5.
- File: `docs/specs/07-spec-navigation-restructure/07-proofs/README.md` — proof index mapping each artifact to the FR/metric it evidences.
- Test: full `pnpm test:ci` run shows existing favorites add/remove/list tests (`favorites/route.test.ts`, `favorites-search.test.tsx`, `favorite-remove-button.test.tsx`) still pass unchanged, demonstrates no regression.

#### 4.0 Tasks

- [ ] 4.1 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build`; capture the full transcript to `docs/specs/07-spec-navigation-restructure/07-proofs/07-ci-gates.txt`.
- [ ] 4.2 Run `git diff --name-only` (vs the pre-spec baseline) and write `07-touched-files.txt`; explicitly confirm no changes under `db/`, no `package.json` dependency additions, and no edits to favorites add/remove/validate/query logic (`lib/favorites/*`, `app/api/favorites/*` route logic). Also confirm the dev-fixture route `app/dev-fixture/nav/` is **not** referenced by `components/bottom-nav.tsx` or any production route (stays dev-only).
- [ ] 4.3 Write `07-proofs/README.md` indexing every artifact (3 screenshots, CI transcript, touched-files) mapped to its FR/metric; add task proof markdowns (`07-task-01-proofs.md` … `07-task-03-proofs.md`) with the recommended structure and inlined screenshots.
- [ ] 4.4 Commit `docs(nav): proof bundle for Spec 07` with body `Related to T4.0 in Spec 07-spec-navigation-restructure`.
