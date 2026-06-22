# Task 04 Proofs — Mobile-first sign-in screen with Google + Email and all UX states

## Task Summary

This task proves the sign-in UX is implemented: a mobile-first sign-in screen with "Continue with Google" + email magic-link CTAs, an in-place "Check your email" confirmation state after a magic link is requested, a non-technical error state covering the three Auth.js error branches (`OAuthCallback`, `Verification`, `EmailSignin`) plus a default fallback, and a static `/check-email` fallback page used by Auth.js's hosted `verifyRequest` flow. All primary CTAs meet the 44×44px touch-target rule, and every UX branch is covered by automated tests.

## What This Task Proves

- `/signin` renders 200 with both provider CTAs and the email input.
- `/check-email` renders 200.
- `/auth/error?error=<code>` renders 200 with branch-specific, non-technical copy for `OAuthCallback`, `Verification`, `EmailSignin`, and falls back to a generic message for unknown codes — no raw Auth.js codes leaked to users.
- The `(auth)` route group's layout is mobile-first (`min-h-dvh`, safe-area padding, `max-w-md` single column).
- Every primary CTA on `/signin` and `/auth/error` satisfies the 44×44px touch-target rule via `min-h-11 min-w-11` Tailwind utilities — asserted by tests, not just by inspection.
- The signin form, on a successful magic-link request, transitions to an in-place "Check your email" confirmation showing the user's email — verified by a component test that mocks `next-auth/react`'s `signIn`.
- The signin form, on email-provider failure, shows a non-technical alert (`role="alert"`) instead of the raw Auth.js error code — verified by a component test.
- 10 new tests added (5 for the signin form, 5 for the error page); total suite now 21 of 21 passing.
- Production build emits the three new pages (`/signin`, `/check-email`, `/auth/error`) correctly.

## Evidence Summary

- Live `curl -sI` against `/signin`, `/check-email`, and `/auth/error?error=Verification` all return 200.
- Live `curl -s /signin` body contains the Sign-in heading, both CTAs, the email input, and the `min-h-11 min-w-11` Tailwind classes.
- Live `curl -s /auth/error?error=Verification` body contains the Verification-branch's specific copy ("no longer valid", "expire after 24 hours").
- 21 / 21 unit + integration tests pass.
- `format:check`, `lint`, `typecheck`, `build` all green.

---

## Artifact 1 — `/signin` renders 200 with the expected mobile-first content

**What it proves:** The sign-in screen exists, returns a 200 from the live dev server, and the rendered HTML includes both provider CTAs, the email input, the page heading, and the `min-h-11 min-w-11` touch-target classes.

**Why it matters:** Spec FRs "mobile-first sign-in screen with Continue with Google and Continue with Email" and "44×44px touch targets" — both visible in the markup that ships to the browser.

**Command:**

```bash
pnpm dev &
sleep 8
curl -sI http://localhost:3000/signin   # status only
curl -s  http://localhost:3000/signin   # full body
```

**Result summary:** HTTP 200. Body contains all expected elements:

- `<h1>Sign in</h1>`
- `<button>Continue with Google</button>` with `min-h-11 min-w-11`
- `<input id="email" type="email" required ... />`
- `<button>Continue with Email</button>` with `min-h-11 min-w-11`
- `<title>Sign in · ScoreMate</title>`
- Body wrapped in `min-h-dvh flex flex-col` with safe-area padding on `<main>`

```html
HTTP/1.1 200 OK
Cache-Control: no-cache, must-revalidate
```

Selected excerpts from the rendered HTML:

```html
<main class="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8">
    <section class="flex flex-col gap-8">
      <header><h1 class="text-3xl font-semibold leading-tight tracking-tight">Sign in</h1></header>
      <div class="flex flex-col gap-6">
        <button type="button" class="inline-flex min-h-11 min-w-11 w-full ...">Continue with Google</button>
        ...
        <form>
          <input id="email" type="email" autoComplete="email" required ... />
          <button type="submit" class="inline-flex min-h-11 min-w-11 w-full ...">Continue with Email</button>
        </form>
      </div>
    </section>
  </div>
</main>
```

---

## Artifact 2 — `/auth/error?error=Verification` renders the Verification-branch copy

**What it proves:** The error page reads the `?error=` query param and renders the branch-specific, non-technical copy ("no longer valid" + "expire after 24 hours") — proving the error mapping is wired and the raw Auth.js code is not leaked.

**Why it matters:** Spec FR "clear, non-technical error state if … the magic link is expired/already-used."

**Command:**

```bash
curl -sI 'http://localhost:3000/auth/error?error=Verification'
curl -s  'http://localhost:3000/auth/error?error=Verification' | grep -oE 'no longer valid|expire after 24 hours'
```

**Result summary:** HTTP 200; both branch-specific strings present in the rendered HTML. No `Verification` token appears as user-visible text.

```text
HTTP/1.1 200 OK

no longer valid
expire after 24 hours
```

---

## Artifact 3 — Sign-in form behavior covered by 5 unit tests

**What it proves:** Every functional behavior of the sign-in form is enforced by tests, not just by reviewer inspection. Covered:

1. Both Google and email CTAs render (FR: both providers).
2. Both primary buttons carry `min-h-11 min-w-11` (FR: 44×44 touch targets).
3. Clicking Google calls `signIn("google", { callbackUrl: "/home" })`.
4. Submitting a valid email transitions in-place to "Check your email" and displays the entered address (FR: magic-link feedback state).
5. An email-provider failure renders a non-technical `role="alert"` message and does *not* leak the raw Auth.js error code (FR: non-technical error states).

**Why it matters:** These are exactly the spec FRs that a future contributor could regress silently by tweaking the form's wiring. The tests pin the contract.

**Artifact path:** `app/(auth)/signin/page.test.tsx`

**Result summary:** 5/5 pass in 131ms.

```text
 ✓ app/(auth)/signin/page.test.tsx (5 tests) 131ms
   ✓ renders both Google and email provider CTAs
   ✓ primary buttons satisfy the 44px touch-target rule via min-h-11/min-w-11 utilities
   ✓ calls signIn('google', { callbackUrl: '/home' }) when the Google CTA is clicked
   ✓ transitions to the 'Check your email' confirmation after a successful magic-link request
   ✓ shows a non-technical error message when the email provider fails
```

---

## Artifact 4 — Error page branch coverage by 5 unit tests (closes audit finding F1)

**What it proves:** Each of the three Auth.js error codes the spec calls out (`OAuthCallback`, `Verification`, `EmailSignin`) renders a distinct, non-technical message, and unknown codes fall back to a generic message. The "Back to sign in" link is present in every branch.

**Why it matters:** Closes audit finding **F1** (regression-risk blind spot — no automated coverage for the error-mapping logic). If a contributor accidentally collapses two branches into one message or leaks a raw code, these tests fail.

**Artifact path:** `app/auth/error/page.test.tsx`

**Result summary:** 5/5 pass in 90ms.

```text
 ✓ app/auth/error/page.test.tsx (5 tests) 90ms
   ✓ renders a distinct, non-technical message for OAuthCallback
   ✓ renders a distinct, non-technical message for Verification
   ✓ renders a distinct, non-technical message for EmailSignin
   ✓ falls back to the Default message for unknown error codes
   ✓ includes a back-to-signin link in every branch
```

---

## Artifact 5 — Build emits the three new routes correctly

**What it proves:** `pnpm build` succeeds and produces routes for `/signin`, `/check-email`, and `/auth/error`. `/signin` and `/check-email` are statically prerendered (no per-request server work needed); `/auth/error` is dynamic (because it reads the query param).

**Why it matters:** Confirms the routes will work in production exactly as they do in dev.

**Result summary:**

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /auth/error
├ ○ /check-email
└ ○ /signin

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

## Artifact 6 — Full quality-gate run remains green

**What it proves:** All five gates still pass after the Task 4.0 additions.

**Commands:**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
```

**Result summary:** All green. Vitest now reports `Test Files 6 passed (6)` and `Tests 21 passed (21)`.

```text
 ✓ lib/auth/auth.test.ts (4 tests)
 ✓ lib/env.test.ts (4 tests)
 ✓ app/page.test.tsx (2 tests)
 ✓ app/auth/error/page.test.tsx (5 tests)
 ✓ app/(auth)/signin/page.test.tsx (5 tests)
 ✓ db/smoke.test.ts (1 test)

 Test Files  6 passed (6)
      Tests  21 passed (21)
```

---

## User-Handled Follow-up (Sub-task 4.8 — real-browser screenshots)

To complete the screenshot artifacts in the proof set, capture the three states in Chrome DevTools at a **375 px × 812 px** viewport (iPhone 13 emulator):

1. `/signin` — the resting state with both CTAs.
2. `/signin` after submitting an email (you can use a dummy address; the in-place "Check your email" state appears instantly since `signIn(..., { redirect: false })` returns before email actually sends if the key isn't valid).
3. `/auth/error?error=Verification` — the expired-link error state.

Save them under `docs/specs/01-spec-auth-foundation/01-proofs/screenshots/` as `04-signin-mobile-375.png`, `04-check-email-mobile-375.png`, and `04-error-verification-mobile-375.png`. Embed them in this file when convenient.

The DOM-level evidence (Artifact 1) and automated test coverage (Artifacts 3 & 4) already prove the requirements; screenshots are reviewer convenience.

---

## Reviewer Conclusion

The sign-in UX is implemented and live: `/signin`, `/check-email`, and `/auth/error` all return 200 with the expected mobile-first markup, both providers' CTAs render, the magic-link submit transitions to a clear "Check your email" state, each Auth.js error branch maps to a distinct non-technical message, and 10 new automated tests pin the behavior. All five quality gates remain green. Task 5.0 (session-gated home + sign-out) is unblocked.
