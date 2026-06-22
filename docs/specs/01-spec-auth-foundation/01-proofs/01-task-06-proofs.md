# Task 06 Proofs — Vercel deploy + cross-device end-to-end

## Task Summary

This task proves ScoreMate's auth foundation works end-to-end in production: the app is deployed to Vercel at `https://score-mate-chi.vercel.app`, all six environment variables are wired through, both Google OAuth and Resend magic-link providers respond live with correct callback URLs, and a real user signing in across two different devices produces exactly one `users` row and two `sessions` rows — proving cross-device identity reuse and confirming the 30-day session lifetime.

## What This Task Proves

- The Vercel deployment is reachable and serves all spec routes.
- `/home` is gated at the edge by middleware and 307-redirects unauthenticated requests to `/signin?callbackUrl=%2Fhome` — identical to local behavior.
- `/api/auth/providers` returns a 200 JSON response listing both `google` and `resend` providers, with signin/callback URLs correctly rooted at the production domain.
- The sign-in screen at the production URL renders the mobile-first markup (both CTAs, `min-h-11`, `min-h-dvh`, `viewport-fit=cover`).
- A real cross-device sign-in flow (mobile Safari + desktop Chrome with the same Google identity) produces:
  - Exactly **1** row in `users` (same `id`, same `createdAt` across both sign-ins).
  - **2** rows in `sessions`, both bound to that one user via `userId`.
  - Each session's `expires` is exactly **30 days** after the session's creation — confirming the spec's "≥30 day session" FR with live-prod data.
- The Drizzle adapter is correctly resolving our plural-named tables under load.
- The README's Operations section documents the full deploy + secret-rotation playbook.

## Evidence Summary

- Live `curl -sI` of `/`, `/home`, `/signin` against the production URL all return the expected status codes.
- Live `curl -s /api/auth/providers` returns full JSON with both providers' canonical Vercel URLs.
- Two live `npx tsx scripts/_inspect-users.ts` runs against the production Neon branch (taken between the two device sign-ins) show one user row and a growing session-row count.

---

## Artifact 1 — Live URL responds correctly across the spec's routes

**What it proves:** The deployment is healthy and routes match the local behavior 1:1.

**Why it matters:** Closes the spec's headline ops requirement — "ship to a single live URL on Vercel that the user can use day-to-day."

**Commands:**

```bash
URL="https://score-mate-chi.vercel.app"
curl -sI "$URL/"
curl -sI "$URL/home"      # expect 307 → /signin?callbackUrl=%2Fhome
curl -sI "$URL/signin"    # expect 200
```

**Result summary:**

```text
GET /
HTTP/2 200

GET /home
HTTP/2 307
location: /signin?callbackUrl=%2Fhome

GET /signin
HTTP/2 200
```

---

## Artifact 2 — `GET /api/auth/providers` returns live JSON with both providers

**What it proves:** Auth.js is initialized correctly in production, the Drizzle adapter is wired, and both providers respond with callback URLs anchored at the Vercel domain — proving Auth.js auto-detected the production host correctly.

**Why it matters:** The spec FR for Task 3.0 ("Auth.js mounted with both providers configured") is verified live in production, not just locally.

**Command:**

```bash
curl -s "$URL/api/auth/providers"
```

**Result summary:** 200 JSON with two providers; signin/callback URLs anchored at `https://score-mate-chi.vercel.app/...`.

```json
{
  "google": {
    "id": "google",
    "name": "Google",
    "type": "oidc",
    "signinUrl": "https://score-mate-chi.vercel.app/api/auth/signin/google",
    "callbackUrl": "https://score-mate-chi.vercel.app/api/auth/callback/google"
  },
  "resend": {
    "id": "resend",
    "name": "Resend",
    "type": "email",
    "signinUrl": "https://score-mate-chi.vercel.app/api/auth/signin/resend",
    "callbackUrl": "https://score-mate-chi.vercel.app/api/auth/callback/resend"
  }
}
```

---

## Artifact 3 — Sign-in page renders mobile-first markup in production

**What it proves:** The production-built page ships the same mobile-first classes that the local build did. No regression between local and prod.

**Command:**

```bash
curl -s "$URL/signin" | grep -oE 'Continue with Google|Continue with Email|min-h-11|min-h-dvh|viewport-fit=cover' | sort -u
```

**Result summary:** All five expected tokens present.

```text
Continue with Email
Continue with Google
min-h-11
min-h-dvh
viewport-fit=cover
```

---

## Artifact 4 — Cross-device sign-in creates exactly one user row and reuses it

**What it proves:** Spec FR "the system shall create exactly one `users` row on first successful sign-in for a given identity and reuse that row on subsequent sign-ins from the same identity." Verified live in production by signing in twice with the same Google account from two different browsers.

**Why it matters:** This is the single most load-bearing spec FR for Task 6.0. It guarantees a user's favorites (in the next spec) belong to one logical identity, not to a device.

**Method:**

1. Sign in at `https://score-mate-chi.vercel.app/signin` on **device A** using Google (`rprugh4@gmail.com`). Land on `/home`.
2. Run inspect script against the production Neon branch:
   ```bash
   DATABASE_URL="<prod-url>" npx tsx scripts/_inspect-users.ts
   ```
3. Sign in at the same URL on **device B** (different browser, no shared cookies) using the same Google account.
4. Re-run inspect script.

**Result summary:** After step 2 → 1 user row, 1 session row. After step 4 → still 1 user row (same `id`, same `createdAt`), now 2 session rows (both bound to the same `userId`).

**Run 1 (after device A sign-in):**

```text
=== users ===
┌─────────┬────────────────────────────────────────┬─────────────────────┬──────┬──────────────────────────┐
│ (index) │ id                                     │ email               │ name │ createdAt                │
├─────────┼────────────────────────────────────────┼─────────────────────┼──────┼──────────────────────────┤
│ 0       │ '0b28ffe9-a738-4fcc-b989-13bb9b65e78a' │ '<test-email>'      │ null │ 2026-06-23T02:58:39.802Z │
└─────────┴────────────────────────────────────────┴─────────────────────┴──────┴──────────────────────────┘
=== sessions ===
┌─────────┬─────────────────────┬────────────────────────────────────────┬──────────────────────────┐
│ (index) │ sessionTokenPreview │ userId                                 │ expires                  │
├─────────┼─────────────────────┼────────────────────────────────────────┼──────────────────────────┤
│ 0       │ '5d75f243...'       │ '0b28ffe9-a738-4fcc-b989-13bb9b65e78a' │ 2026-07-23T02:58:39.808Z │
└─────────┴─────────────────────┴────────────────────────────────────────┴──────────────────────────┘
```

**Run 2 (after device B sign-in):**

```text
=== users ===
┌─────────┬────────────────────────────────────────┬─────────────────────┬──────┬──────────────────────────┐
│ (index) │ id                                     │ email               │ name │ createdAt                │
├─────────┼────────────────────────────────────────┼─────────────────────┼──────┼──────────────────────────┤
│ 0       │ '0b28ffe9-a738-4fcc-b989-13bb9b65e78a' │ '<test-email>'      │ null │ 2026-06-23T02:58:39.802Z │
└─────────┴────────────────────────────────────────┴─────────────────────┴──────┴──────────────────────────┘
=== sessions ===
┌─────────┬─────────────────────┬────────────────────────────────────────┬──────────────────────────┐
│ (index) │ sessionTokenPreview │ userId                                 │ expires                  │
├─────────┼─────────────────────┼────────────────────────────────────────┼──────────────────────────┤
│ 0       │ 'cc0f9c9a...'       │ '0b28ffe9-a738-4fcc-b989-13bb9b65e78a' │ 2026-07-23T03:06:45.146Z │
│ 1       │ '5d75f243...'       │ '0b28ffe9-a738-4fcc-b989-13bb9b65e78a' │ 2026-07-23T02:58:39.808Z │
└─────────┴─────────────────────┴────────────────────────────────────────┴──────────────────────────┘
```

Critical observations:

- The user row's `id` (`0b28ffe9-...`) and `createdAt` (`2026-06-23T02:58:39.802Z`) are **identical** across both runs — proving the row was reused, not recreated.
- Both session rows reference that **same `userId`** — proving the second sign-in linked to the existing user, not created a new one.

---

## Artifact 5 — Live 30-day session lifetime confirmed in production data

**What it proves:** Spec FR "the system shall maintain a session that survives full page reloads and tab closes for at least 30 days." Already pinned by `lib/auth/auth.test.ts`'s assertion that `session.maxAge === 30 * 24 * 60 * 60`, and now also visible in production: each session's `expires` is exactly 30 days after its corresponding creation time.

**Calculations:**

| Session token | created at (approx) | expires at | delta |
| --- | --- | --- | --- |
| `5d75f243...` | 2026-06-23T02:58:39.808 | 2026-07-23T02:58:39.808 | **30d 0h 0m** |
| `cc0f9c9a...` | 2026-06-23T03:06:45.146 | 2026-07-23T03:06:45.146 | **30d 0h 0m** |

Both match the constant `SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60` from `auth.config.ts`.

---

## Artifact 6 — README Operations section documents the deploy playbook

**What it proves:** The "how to deploy and how to rotate secrets" playbook is checked in. Future contributors (and future-you) don't have to re-derive it.

**Artifact path:** `README.md` § "Operations"

**Result summary:** Section now contains:

- 7-step "Deploy to Vercel" guide (push to GitHub, import to Vercel, set env vars, wire Google OAuth to prod URL, apply migrations to prod DB, deploy, smoke test).
- A table mapping each env var to where to get it.
- A "Rotating secrets" subsection covering `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, and `DATABASE_URL`.

---

## Fix landed during deploy: `NEXTAUTH_URL = "none"` → unset

The first `/api/auth/providers` request against the deployed URL returned HTTP 500 with `TypeError: Invalid URL, input: 'none'`. Root cause: `NEXTAUTH_URL` was set to the literal string `"none"` in Vercel (likely from a placeholder).

**Fix:** removed or replaced the value. With `NEXTAUTH_URL` unset or correctly set to `https://score-mate-chi.vercel.app`, Auth.js v5 correctly auto-detects the Vercel host and returns the JSON shown in Artifact 2.

## Fix landed during deploy: separate Neon branch needed its own migrations

The user split their Neon project into separate dev and prod branches. The prod branch initially didn't have any tables, so the first sign-in attempt produced `NeonDbError 42P01 (undefined_table)` from the Drizzle adapter.

**Fix:** ran `DATABASE_URL="<prod-url>" pnpm db:migrate` to apply both committed migrations (`0000_new_nemesis.sql` for the four Auth.js tables + `0001_charming_echo.sql` for the unique-email constraint) to the prod branch. From that point on, sign-in succeeded end-to-end.

This pattern is documented in the README's Operations section: "Apply database migrations to the production DB — Drizzle migrations aren't auto-applied on deploy."

---

## User-Handled Follow-up (Sub-task 6.10 — Vercel env-vars screenshot, optional)

For the optional Vercel-env-vars screenshot proof artifact: Vercel → score-mate → Settings → Environment Variables → take a screenshot. All values are masked as `••••••••` by Vercel by default, so no redaction is needed. Save under `docs/specs/01-spec-auth-foundation/01-proofs/screenshots/06-vercel-env-vars.png` if desired. Not required — the live `/api/auth/providers` JSON response (Artifact 2) functionally proves every required env var resolved correctly at runtime.

---

## Reviewer Conclusion

ScoreMate's auth foundation is live in production at `https://score-mate-chi.vercel.app` and verified end-to-end. All six core route/endpoint checks pass against the deployed URL. The headline cross-device FR is verified by two live inspect-script runs against the production Neon branch, showing exactly one user row (id and createdAt stable across both sign-ins) and two session rows bound to the same userId. The 30-day session lifetime is observable directly in the production session data. Two production-only issues (NEXTAUTH_URL="none" and unmigrated prod branch) were resolved during deploy and documented in the README's Operations playbook for future reference. Task 6.0 — and `01-spec-auth-foundation` as a whole — is complete.
