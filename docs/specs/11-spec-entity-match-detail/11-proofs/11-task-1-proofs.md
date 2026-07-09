# Task 1.0 Proofs - Tappable entity cards + detail route shell with back navigation

## Task Summary

This task establishes the navigation shell for the entity match-detail feature: every card on the Teams tab is now a real link into a new, deep-linkable, auth-gated route (`/teams/[favoriteId]`). The detail screen resolves the favorite server-side, renders a header (entity name + badge + back control to Teams), and shows a friendly not-found state when the id is unknown or belongs to another user.

## What This Task Proves

- `EntityCard` renders as an accessible link to `/teams/[favoriteId]` — the literal "click the player or team" entry point from the spec.
- The new `/teams/[favoriteId]` route is authoritatively auth-gated (redirects to `/signin` when there's no session), matching the pattern used by `teams/page.tsx`.
- The route resolves the favorite by id scoped to the signed-in user (via `listFavoritesForUser`) and renders a not-found state for unknown ids, foreign-user ids, and non-team/player favorite types (e.g. a `league` favorite) — never leaking another user's data.
- The header shows the entity's name (and badge, for teams) plus a back link to `/teams`.

## Evidence Summary

- `components/entity-card.test.tsx` and `app/(app)/teams/[favoriteId]/page.test.tsx` — 12 new/updated tests, all passing — cover the link, the auth redirect, the not-found states, and the header render.
- A live dev-server check confirms the auth gate fires for real: navigating to `/ScoreMate/teams/some-fake-id` while unauthenticated redirects to the Sign In screen.
- `pnpm typecheck` and `pnpm format:check` pass clean. `pnpm lint` has one pre-existing failure in `components/home-client.tsx` (confirmed via `git stash` to exist on `main` before this task's changes) that is unrelated to this task's files; it has been flagged separately rather than folded into this commit.

## Artifact: Entity card and detail-route tests

**What it proves:** The card is a real, labeled link to the correct URL, and the new route's auth-gate + favorite-resolution + not-found logic all behave correctly.

**Why it matters:** This is the direct, automated proof of the task's functional requirements (card-as-link, accessible label, auth gate, ownership-scoped resolution, not-found state).

**Command:**

```bash
npx vitest run components/entity-card.test.tsx "app/(app)/teams/[favoriteId]/page.test.tsx"
```

**Result summary:** Both suites pass — 7 tests in `entity-card.test.tsx` (including the new "renders as a link ... with an accessible label" case) and 5 tests in `page.test.tsx` (unauthenticated redirect, not-found for an unknown id, not-found for a non-team/player favorite, valid team header, valid player header).

```
✓ components/entity-card.test.tsx (7 tests) 74ms
✓ app/(app)/teams/[favoriteId]/page.test.tsx (5 tests) 53ms

Test Files  2 passed (2)
     Tests  12 passed (12)
```

## Artifact: Live auth-gate check (unauthenticated navigation)

**What it proves:** The route is authoritatively auth-gated at runtime, not just in a mocked test — visiting the detail URL without a session lands on Sign In.

**Why it matters:** Authorization on a per-user resource is a security-relevant requirement (spec's Security Considerations section); this confirms it holds against the real Next.js route, not just an isolated unit test.

**Command (evaluated in the running dev server):**

```js
window.location.href = "http://localhost:3000/ScoreMate/teams/some-fake-id";
```

**Result summary:** The browser landed on the Sign In screen ("Save the teams, leagues, sports, and tournaments you follow." / "Continue with Google" / "Continue with Email"), confirming the redirect fired.

Full authenticated screenshots of the header + navigation flow require a real OAuth or magic-link sign-in, which isn't available in this sandboxed preview environment. The automated tests above cover the authenticated header/not-found rendering directly.

Accessibility snapshot of the resulting page:

```
[1] RootWebArea: "Sign in · ScoreMate"
  [8] heading: "Sign in"
  [24] button: "Continue with Google"
  [33] textbox: "Email"
  [36] button: "Continue with Email"
```

## Artifact: Quality gates

**What it proves:** The new/changed code is type-safe and correctly formatted, and does not introduce any new lint issues.

**Why it matters:** Repository quality gates (`pnpm typecheck`, `pnpm format:check`, `pnpm lint`) run on every PR via CI.

**Commands:**

```bash
pnpm typecheck
pnpm format:check
pnpm lint
```

**Result summary:** `typecheck` and `format:check` pass with no output/errors. `lint` reports one error in `components/home-client.tsx:401` (`no-html-link-for-pages`) — confirmed via `git stash` to already exist on `main` prior to this task's changes, so it is not introduced by this work. It has been flagged as a separate follow-up rather than bundled into this task's commit.

```
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ tsc --noEmit
(no output — success)
```

## Reviewer Conclusion

Tapping a team or player on the Teams tab now navigates to a real, deep-linkable detail route that is auth-gated, ownership-scoped, and renders a correct header/back-navigation shell or a graceful not-found state. All new logic is covered by passing automated tests, and the live dev server confirms the auth gate holds at runtime. The only outstanding gate issue is a pre-existing, unrelated lint error on `main`.
