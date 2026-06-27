# 07-spec-navigation-restructure.md

## Introduction/Overview

The app's primary navigation has grown confusing: the bottom nav exposes three text-only destinations — **Home**, **Favorites** (which is actually the *search/add* screen), and **My Favorites** (the *saved list*) — and there is no Settings/Account destination at all. The `AccountMenu` component (signed-in identity + Sign out) exists but is mounted nowhere, so a signed-in user currently has **no way to sign out**. This spec restructures navigation into a clean three-destination bottom nav (**Home · Favorites · Settings**), merges the two favorites screens into one page, and adds a lightweight Settings page that restores the sign-out path.

## Goals

- Merge the search/add screen and the saved-favorites list into a single **Favorites** page, eliminating the "Favorites vs My Favorites" ambiguity.
- Add a **Settings** page that surfaces the user's signed-in identity and a working **Sign out** action, plus basic app info.
- Redesign the bottom nav to **three icon+label destinations** (Home · Favorites · Settings) using inline SVG icons (no new dependency), preserving accessibility and touch-target rules.
- Keep existing favorites data and behavior intact (no schema or favorites-logic changes); this is a navigation/layout reorganization only.
- Avoid broken links: existing `/my-favorites` URLs continue to work via redirect.

## User Stories

- **As a signed-in user**, I want one "Favorites" screen where I can both search for and see my saved favorites, so I'm not confused by two similarly-named pages.
- **As a signed-in user**, I want a Settings page with a clear **Sign out** button, so I can actually sign out of the app.
- **As a mobile user**, I want a simple bottom nav with recognizable icons, so I can move between the main screens with my thumb at a glance.
- **As a returning user** who bookmarked `/my-favorites`, I want that link to still take me to my favorites, so my bookmarks don't break.

## Demoable Units of Work

### Unit 1: Unified Favorites page

**Purpose:** Combine the add/search screen (`/favorites`) and the saved-list screen (`/my-favorites`) into a single Favorites page so "add" and "manage" live in one place.

**Functional Requirements:**

- The system shall render, at `/favorites`, a single page containing both (a) the favorites search/add section and (b) the user's saved favorites grouped by type (Teams, Leagues, Sports, Tournaments), reusing the existing `FavoritesSearch` and saved-list/grouping behavior.
- The system shall display the saved-favorites section with the same grouping and remove-button behavior currently on `/my-favorites` (no change to add/remove logic).
- The system shall redirect `/my-favorites` to `/favorites` so existing links and bookmarks resolve.
- The system shall show an appropriate empty state in the saved section when the user has no favorites.

**Proof Artifacts:**

- Test: `app/(app)/favorites/page.test.tsx` asserts the page renders both the search/add section and the saved-favorites groups for a user with favorites — demonstrates the merge.
- Test: a redirect test (or route check) asserts `/my-favorites` redirects to `/favorites` — demonstrates no broken links.
- Screenshot: `docs/specs/07-spec-navigation-restructure/07-proofs/07-favorites-unified.png` showing the add section above the grouped saved list — demonstrates the unified layout.

### Unit 2: Settings page with working sign-out

**Purpose:** Add a Settings destination that restores the missing sign-out path and shows the user's account identity.

**Functional Requirements:**

- The system shall add a `/settings` route (inside the authenticated `(app)` group) that renders the user's signed-in identity (display name and/or email) and a **Sign out** action wired to the existing Auth.js `signOut` server action.
- The system shall reuse or adapt the existing `AccountMenu` component for the identity + sign-out block rather than duplicating sign-out logic.
- The system shall display basic app info (e.g. app name and a short descriptor or version line) on the Settings page.
- The Settings page shall not include profile editing, avatar upload, password, account deletion, or a theme toggle (see Non-Goals).

**Proof Artifacts:**

- Test: `app/(app)/settings/page.test.tsx` asserts the page renders the signed-in identity and a Sign-out control (a `form` posting to the sign-out action) — demonstrates the account surface.
- Screenshot: `docs/specs/07-spec-navigation-restructure/07-proofs/07-settings.png` showing the Settings page with identity + Sign out — demonstrates the restored sign-out path.

### Unit 3: Redesigned bottom navigation

**Purpose:** Replace the three text-only items with a clean three-destination icon+label bottom nav.

**Functional Requirements:**

- The system shall render the bottom nav with exactly three destinations in order: **Home** (`/home`), **Favorites** (`/favorites`), **Settings** (`/settings`).
- Each nav item shall display an inline SVG icon above its text label (no new icon dependency).
- The active destination shall be visually distinct and expose `aria-current="page"`, matching the current active-state pattern; route prefixes shall still resolve as active (e.g. `/favorites/…`).
- Each nav item shall remain a ≥44×44 px touch target (`min-h-11`/`min-w-11`) and the nav shall continue to honor bottom safe-area insets.
- The "My Favorites" nav item shall be removed.

**Proof Artifacts:**

- Test: `components/bottom-nav.test.tsx` asserts exactly three items (Home, Favorites, Settings), each with an icon (`svg`) and label, correct `href`s, active-state + `aria-current`, and `min-h-11` targets — demonstrates the redesigned nav.
- Screenshot: `docs/specs/07-spec-navigation-restructure/07-proofs/07-bottom-nav.png` showing the three icon+label destinations with one active — demonstrates the visual redesign.

## Non-Goals (Out of Scope)

1. **Account management** — no profile editing, display-name change, avatar upload, password, MFA, or account deletion (standing Spec 01 non-goals).
2. **Theme system / dark-mode toggle** — no `next-themes` or theme switcher; the app keeps its current automatic light/dark behavior.
3. **Favorites logic changes** — no changes to how favorites are added, removed, validated, matched, or stored; this spec only relocates/regroups the UI. No DB schema change.
4. **New favorites features** — no tabs-with-filters, sorting, or bulk actions beyond what `/my-favorites` already does.
5. **Homepage changes** — the `/home` feed (matches, tennis day-feed) is untouched.
6. **Internationalization, analytics, native app** — unchanged (standing non-goals).

## Design Considerations

- **Bottom nav:** mobile-first, thumb-reachable, three equal-width items each stacking a centered inline-SVG icon above a small text label. Keep the existing active treatment (distinct bg + text color) and the `md:`+ behavior. Icons should be simple line/outline glyphs consistent with the minimal aesthetic (e.g. a house for Home, a star/heart for Favorites, a gear for Settings).
- **Unified Favorites page:** the add/search section sits at the top under a clear heading, with the grouped saved-favorites list below it on the same scrollable page (stacked, not tabbed). Reuse existing spacing, max-width (`max-w-md`), and safe-area padding patterns.
- **Settings page:** a simple stacked layout reusing the bordered `AccountMenu` card styling, with an app-info line beneath it.
- Honor `min-h-dvh` full-height layout and `env(safe-area-inset-*)` per `AGENTS.md`.

## Repository Standards

- Next.js 16 App Router; server components by default, `"use client"` only where needed (the nav is already a client component for `usePathname`). Routes live under `app/(app)/` and are auth-gated by the existing `(app)` layout.
- TypeScript `strict`, no `any`, no unjustified `@ts-ignore`.
- Tailwind v4 mobile-first; ≥44 px touch targets via `min-h-11`/`min-w-11`; safe-area insets.
- Vitest + React Testing Library, colocated tests next to source.
- ESLint + Prettier; Conventional Commits with `Related to T#.# in Spec 07-spec-navigation-restructure` in the body.
- No new runtime dependencies (icons are inline SVG). No DB migration.

## Technical Considerations

- **Routing/redirect:** `/favorites` becomes the unified page. `/my-favorites` should redirect to `/favorites` (e.g. a small route handler/page that calls `redirect("/favorites")`, or a Next.js `redirects()` config entry) so existing links don't 404. The current `/my-favorites/page.tsx` saved-list rendering moves into the `/favorites` page.
- **Component reuse:** keep `FavoritesSearch` (add) and the grouping/`FavoriteRemoveButton` (list) intact; the unified page composes both. Extract the saved-list grouping into a reusable piece if cleaner, but no behavior change.
- **Account/sign-out:** the existing `AccountMenu` (a server component wrapping the Auth.js `signOut` server action) is reused on `/settings`. Confirm it renders correctly as a page section; adapt styling only.
- **Icons:** add ~3 inline SVG icon components (or a small `nav-icons.tsx`) — outline style, `aria-hidden`, sized ~20–24 px. The nav item keeps its label for accessibility.
- **Active state:** preserve the existing `pathname === href || pathname.startsWith(href + "/")` logic so nested routes still highlight the right tab.
- No new aggregator, API, or data-layer work.

## Security Considerations

- Sign-out continues to use the existing Auth.js v5 server-action pattern (`signOut({ redirectTo: "/signin" })`); no client-side credential handling is introduced.
- `/settings` and `/favorites` remain inside the auth-gated `(app)` route group; unauthenticated users are redirected by the existing layout guard.
- Proof-artifact screenshots must redact any real user email shown on the Settings page (use a placeholder/test account).
- No new secrets, tokens, or sensitive data are introduced.

## Success Metrics

1. **Three-destination nav:** the bottom nav renders exactly Home · Favorites · Settings, each with an icon + label and correct active state. Verified by `bottom-nav.test.tsx` + screenshot.
2. **Unified favorites:** `/favorites` shows both add/search and the grouped saved list; `/my-favorites` redirects to it. Verified by page test + redirect test.
3. **Sign-out restored:** a signed-in user can reach `/settings` and sign out. Verified by `settings/page.test.tsx` + screenshot.
4. **No regressions:** existing favorites add/remove/list tests still pass; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build` all exit 0.
5. **No new dependencies / no schema change:** `package.json` dependencies and `db/` schema are unchanged.

## Open Questions

1. **Icon glyph choices:** exact icons for Home/Favorites/Settings (e.g. star vs heart for Favorites) can be finalized during implementation; any simple, recognizable outline set is acceptable.
2. **App-info content on Settings:** whether to show a version string (from `package.json`) or just the app name + a one-line descriptor — minor, decide during implementation.
