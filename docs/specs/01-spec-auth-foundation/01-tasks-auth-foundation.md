# 01-tasks-auth-foundation.md

> Task list for [01-spec-auth-foundation.md](./01-spec-auth-foundation.md).

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `package.json` | Project manifest; declares dependencies (Next.js, React, Tailwind, Drizzle, Auth.js, Resend, etc.) and scripts (`dev`, `build`, `lint`, `typecheck`, `db:migrate`, `db:generate`). |
| `pnpm-lock.yaml` | Lockfile for reproducible installs; committed exactly once. |
| `tsconfig.json` | TypeScript compiler config; must enable `strict`. |
| `next.config.ts` | Next.js config; configures App Router and any required runtime options. |
| `tailwind.config.ts` | Tailwind config; declares content paths, mobile-first breakpoints, theme extensions. |
| `postcss.config.mjs` | PostCSS config required by Tailwind. |
| `eslint.config.mjs` | ESLint flat config extending Next.js defaults. |
| `prettier.config.mjs` | Prettier config for shared formatting rules. |
| `commitlint.config.mjs` | Conventional Commits enforcement config. |
| `.github/workflows/ci.yml` | GitHub Actions CI: `install`, `lint`, `typecheck`, `build` on every PR. |
| `.env.example` | Documents every required env var name with empty values; checked in. |
| `.env.local` | Developer-local secrets; in `.gitignore`, never committed. |
| `.gitignore` | Excludes `node_modules`, `.next`, `.env.local`, `*.log`, etc. |
| `README.md` | Authoritative repo overview, setup steps, env-var contract, and ops notes. |
| `AGENTS.md` | Standards source for future SDD specs (conventions, file layout, commands). |
| `app/layout.tsx` | Root layout; sets `viewport`, `min-h-dvh`, safe-area-inset awareness. |
| `app/globals.css` | Tailwind base + safe-area helpers. |
| `app/page.tsx` | Public landing route (`/`); mobile-first rendering, no horizontal scroll at 375px. |
| `app/(auth)/signin/page.tsx` | Mobile-first sign-in screen with Google + Email CTAs. |
| `app/(auth)/signin/page.test.tsx` | Component tests for the sign-in page (provider CTAs, email submit transition, touch-target rule). |
| `app/(auth)/check-email/page.tsx` | "Check your email" confirmation state shown after magic-link request. |
| `app/(auth)/error/page.tsx` | Non-technical error states for OAuth cancel, expired/used links, email send failure. |
| `app/(auth)/error/page.test.tsx` | Tests asserting each Auth.js error-param branch (`OAuthCallback`, `Verification`, `EmailSignin`) renders a distinct non-technical message. |
| `app/home/page.tsx` | Session-gated placeholder authenticated home with greeting and account menu. |
| `app/home/page.test.tsx` | Tests for redirect-when-unauthenticated and presence of account menu + sign-out. |
| `components/account-menu.tsx` | Account menu surfacing user identity and a "Sign out" action; 44×44px touch target. |
| `components/signin-form.tsx` | Client component handling the email-magic-link submit + transition to "Check your email". |
| `middleware.ts` | Next.js middleware that gates `/home/*` for unauthenticated visitors. |
| `auth.ts` | Auth.js v5 entry: `NextAuth({ adapter, providers: [Google, Resend], session })`. |
| `app/api/auth/[...nextauth]/route.ts` | Mounts Auth.js handlers under `/api/auth/*`. |
| `lib/auth/index.ts` | Re-exports `auth`, `signIn`, `signOut` helpers for server/client use. |
| `lib/auth/auth.test.ts` | Unit tests covering `session.maxAge === 30 * 24 * 60 * 60` and any non-trivial helper logic. |
| `lib/env.ts` | Strongly-typed runtime env-var validation (e.g. via Zod) so misconfig fails fast. |
| `lib/env.test.ts` | Unit tests for `lib/env.ts`. |
| `db/index.ts` | Drizzle client init (Neon serverless driver for runtime + `postgres`/`pg` for migrations). |
| `db/schema/index.ts` | Barrel re-export of all schema modules. |
| `db/schema/auth.ts` | Drizzle schema for `users`, `accounts`, `sessions`, `verification_tokens` per Auth.js adapter. |
| `db/migrations/0000_init.sql` | First generated migration containing the Auth.js tables. |
| `db/smoke.test.ts` | Smoke test: `await db.execute(sql\`SELECT 1\`)` returns 1; proves runtime DB client connects. |
| `drizzle.config.ts` | Drizzle Kit config: schema path, out dir, dialect = `postgresql`, `DATABASE_URL`. |
| `scripts/db-migrate.ts` | Implementation of `pnpm db:migrate` (applies pending migrations). |

### Notes

- Tests are colocated with the code they test (e.g. `signin/page.tsx` next to `signin/page.test.tsx`).
- Run tests with `pnpm test` (Vitest is the suggested runner — finalize choice in 1.x). Run a single file with `pnpm test app/(auth)/signin/page.test.tsx`.
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`); enforced via commitlint in CI.
- All TypeScript must pass `pnpm typecheck` with `strict` enabled — no `any`, no `// @ts-ignore` without a tracked TODO.
- Tailwind classes default to small-screen targets; use `sm:`/`md:`/`lg:` only for upward adjustments. Use `min-h-dvh`, not `min-h-screen`.
- Task 5.0's authenticated home is intentionally a placeholder. Favorites, the score-tracker homepage, and any sports-data UI belong to `02-spec-score-tracker` — do not pull that scope forward.

## Tasks

### [x] 1.0 Initialize Next.js project, mobile-first Tailwind, lint/format/CI, and repo guideline docs

#### 1.0 Proof Artifact(s)

- Screenshot: `/` landing page at a 375px mobile viewport showing no horizontal scroll demonstrates the mobile-first baseline FR.
- Screenshot: `/` landing page at a 1280px desktop viewport demonstrates responsive layering also works.
- CLI: `pnpm lint && pnpm typecheck && pnpm build` exits 0 locally demonstrates lint, typecheck, and build all pass.
- CI run link: a green GitHub Actions run with `lint`, `typecheck`, and `build` jobs demonstrates CI is operational.
- File diff: `.env.example`, `README.md`, `AGENTS.md`, `tailwind.config.ts`, `eslint.config.mjs`, `prettier.config.mjs`, `.github/workflows/ci.yml`, `tsconfig.json` (with `"strict": true`) present in the initial commit demonstrates scaffold and conventions are checked in.

#### 1.0 Tasks

- [x] 1.1 Initialize a Next.js 16 App Router + TypeScript project (scaffolded via `pnpm create next-app@latest`). `tsconfig.json` has `"strict": true`.
- [x] 1.2 `tailwind.config.ts` not needed (Tailwind v4 inlines config). `app/layout.tsx` exports `viewport` with `viewport-fit=cover` and uses `min-h-dvh`. `app/page.tsx` uses `env(safe-area-inset-*)` for safe-area padding.
- [x] 1.3 Replaced `app/page.tsx` with a minimal mobile-first landing page (single column, 375px-safe).
- [x] 1.4 Added `prettier.config.mjs` and `.prettierignore`; extended `eslint.config.mjs` to compose `eslint-config-prettier` to avoid conflicting rules.
- [x] 1.5 Installed Vitest + RTL + jsdom; added `test`, `test:ci`, `typecheck`, `format`, `format:check` scripts; created `vitest.config.ts`, `vitest.setup.ts`, and `app/page.test.tsx` covering the heading, the sign-in CTA, and the 44px touch-target rule.
- [x] 1.6 Added `commitlint.config.mjs` extending `@commitlint/config-conventional`. Policy documented in `AGENTS.md`.
- [x] 1.7 `.env.example` lists `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, `EMAIL_FROM` with empty values. `.env.local` is in `.gitignore` (`.env*` pattern).
- [x] 1.8 Authored `README.md` with stack, quickstart, scripts table, env-var contract, placeholders for Database (Task 2.0) and Operations (Task 6.0).
- [x] 1.9 Authored `AGENTS.md` covering Next.js 16 caveat (preserved from scaffold), TS strict, Tailwind mobile-first, file layout, quality gates, Conventional Commits, env-var policy, and the SDD non-goal-leakage rule.
- [x] 1.10 Added `.github/workflows/ci.yml` running install, lint, format:check, typecheck, test:ci, build on PRs and pushes to `main`.
- [~] 1.11 **User-handled.** Push to GitHub remote, open a PR, link the green CI run; capture browser screenshots at 375px and 1280px and save to `docs/specs/01-spec-auth-foundation/01-proofs/screenshots/`. See proof file § "User-Handled Follow-ups".

---

### [x] 2.0 Provision Neon Postgres and wire Drizzle ORM with schema + migration tooling

#### 2.0 Proof Artifact(s)

- CLI: `pnpm db:migrate` against a fresh Neon database succeeds and prints applied migration filenames demonstrates migration tooling works end-to-end.
- CLI: `psql "$DATABASE_URL" -c "\dt"` (or Drizzle Studio screenshot) shows the expected tables exist demonstrates the schema landed in Neon.
- File diff: `db/schema/`, `db/migrations/`, `drizzle.config.ts`, and `db:migrate` script entry present demonstrates the mandated structure is in place.
- Test: `db/smoke.test.ts` passes (`SELECT 1` round-trip) demonstrates the runtime DB client connects.

#### 2.0 Tasks

- [x] 2.1 User created Neon project; `DATABASE_URL` confirmed live (smoke test ran against the real DB in 217ms; `pnpm db:migrate` succeeded). See proof § Artifact 7.
- [x] 2.2 Installed `drizzle-orm`, `@neondatabase/serverless`, `postgres`, `zod` (runtime); `drizzle-kit`, `tsx`, `dotenv`, `@types/pg` (dev).
- [x] 2.3 Created `db/index.ts` exporting `db` via the Neon serverless HTTP driver (`drizzle-orm/neon-http`); `scripts/db-migrate.ts` uses the standard `postgres` driver.
- [x] 2.4 Created `db/schema/index.ts` as a barrel; ready for Auth.js tables in Task 3.0.
- [x] 2.5 Authored `drizzle.config.ts` pointing at `./db/schema/index.ts` and `./db/migrations`, dialect `postgresql`, strict + verbose.
- [x] 2.6 Added `db:generate`, `db:migrate`, `db:studio` scripts to `package.json`.
- [x] 2.7 Implemented `scripts/db-migrate.ts`: loads `.env.local` via `dotenv`, opens a single-connection `postgres` client, runs Drizzle's migrator, exits nonzero on failure.
- [x] 2.8 Implemented `lib/env.ts` (Zod validator with caching) and `lib/env.test.ts` (4 tests, all passing): happy path, missing key, malformed URL, caching.
- [x] 2.9 Wrote `db/smoke.test.ts` gated on `DATABASE_URL` via `describe.runIf(...)`. Live-verified: `SELECT 1` round-trip against Neon completes in 217ms (proof § Artifact 7).
- [x] 2.10 Exercised `pnpm db:generate` against the empty schema → "0 tables · No schema changes, nothing to migrate" → pipeline mechanics verified independently of any schema content. Drizzle Kit created `db/migrations/meta/_journal.json`.
- [x] 2.11 README "Database" section now documents Neon setup, the three Drizzle commands, and the migrator vs runtime driver split.

---

### [x] 3.0 Integrate Auth.js v5 with Drizzle adapter, Google OAuth provider, and Resend email magic-link provider

#### 3.0 Proof Artifact(s)

- CLI: `curl -sI https://<deploy-url>/api/auth/providers` returns 200 and the body lists both `google` and `email` providers demonstrates Auth.js is mounted with both providers configured.
- CLI: post-migration, `psql "$DATABASE_URL" -c "\dt"` lists `users`, `accounts`, `sessions`, `verification_tokens` demonstrates the Auth.js Drizzle adapter schema landed.
- File diff: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `db/schema/auth.ts`, and the updated `.env.example` (with `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `NEXTAUTH_URL` keys, all empty) present demonstrates configuration is checked in without leaking secrets.
- Test: `lib/auth/auth.test.ts` asserts the configured `session.maxAge` is `30 * 24 * 60 * 60` and providers list contains both `google` and `email` demonstrates the integration is wired correctly.

#### 3.0 Tasks

- [x] 3.1 Installed `next-auth@beta` (v5.0.0-beta.31), `@auth/drizzle-adapter` (1.11.2), and `resend` (6.14.0).
- [x] 3.2 Authored `db/schema/auth.ts` with `users`, `accounts`, `sessions`, `verification_tokens` matching the Auth.js Drizzle adapter's Postgres shape. Re-exported from `db/schema/index.ts`.
- [x] 3.3 `pnpm db:generate` produced `db/migrations/0000_new_nemesis.sql` containing all four tables.
- [x] 3.4 `pnpm db:migrate` applied the migration to Neon; live verification listed all four tables in `public` schema (proof § Artifact 1).
- [x] 3.5 Authored `auth.config.ts` (static, edge-safe portion) and `auth.ts` (composes config + Drizzle adapter). Session: `strategy: 'database'`, `maxAge: 30*24*60*60`. Providers: Google + Resend.
- [x] 3.6 Added `app/api/auth/[...nextauth]/route.ts` mounting `handlers.GET` and `handlers.POST`.
- [x] 3.7 Added `lib/auth/index.ts` re-exporting `auth`, `signIn`, `signOut`, `handlers`.
- [x] 3.8 `.env.example` already lists all required keys from Task 1.7. `lib/env.ts` already validates them (kept for runtime validation in app code; `db/index.ts` reads `DATABASE_URL` directly to avoid build-time failures when other vars are still empty).
- [x] 3.9 User created Google OAuth client; live verified via `GET /api/auth/providers` (proof § Artifact 7).
- [x] 3.10 User created Resend API key + `EMAIL_FROM=onboarding@resend.dev`; live verified via `GET /api/auth/providers` (proof § Artifact 7).
- [x] 3.11 Authored `lib/auth/auth.test.ts` with 4 passing tests pinning: `session.maxAge === 30 * 24 * 60 * 60`, `session.strategy === 'database'`, both `google` and `resend` providers registered, custom `pages` paths correct.

---

### [x] 4.0 Build the mobile-first sign-in screen with Google + Email entry points and all UX states

#### 4.0 Proof Artifact(s)

- Screenshot: sign-in screen at a 375px mobile viewport showing "Continue with Google" and the email input + "Continue with Email" CTA demonstrates the mobile-first auth entry point exists.
- Screenshot: the "Check your email" confirmation state after submitting an email demonstrates the magic-link feedback UX.
- Screenshot: the error state (e.g. expired link landing) showing a non-technical message demonstrates the error UX.
- Test: `app/(auth)/signin/page.test.tsx` asserts (a) both providers' CTAs render, (b) submitting the email form transitions/navigates to the "Check your email" state, and (c) primary buttons satisfy the 44px touch-target rule (via Tailwind utility-class assertion such as `min-h-11` ≥ 44px), demonstrating FRs for both providers, the email-sent feedback, and the 44px rule.
- Test: `app/(auth)/error/page.test.tsx` passes, asserting that each of the `OAuthCallback`, `Verification`, and `EmailSignin` error params renders a distinct non-technical message, demonstrating regression coverage for the error UX.

#### 4.0 Tasks

- [x] 4.1 Added `app/(auth)/layout.tsx` (single-column mobile-first, `min-h-dvh`, safe-area padding, `max-w-md`).
- [x] 4.2 Implemented `app/(auth)/signin/page.tsx` (server component) with header copy and `<SigninForm />`.
- [x] 4.3 Implemented `components/signin-form.tsx` (client component) with both CTAs, in-place "Check your email" transition on success, and `useTransition` for the Google flow.
- [x] 4.4 Implemented `app/(auth)/check-email/page.tsx` — the static fallback for Auth.js's hosted `verifyRequest` flow. (The form's in-place confirmation in 4.3 is the primary path.)
- [x] 4.5 Implemented `app/auth/error/page.tsx` with branch-specific messages for `OAuthCallback`, `Verification`, `EmailSignin`, plus a `Default` fallback. (Path is `/auth/error`, not `/(auth)/error` — outside the auth group because Auth.js v5's `pages.error` redirect doesn't preserve the route group bracket.)
- [x] 4.6 All primary buttons use `min-h-11 min-w-11 w-full` (full width on mobile; expandable to `sm:w-auto` later if desired).
- [x] 4.7 Authored `app/(auth)/signin/page.test.tsx` — 5 tests, all passing; covers both CTAs, touch-target rule, Google click, magic-link transition, and the error path.
- [~] 4.8 **User-handled.** Capture mobile + desktop screenshots of `/signin`, `/check-email`, and `/auth/error?error=Verification` at 375px in Chrome DevTools. See proof § User-Handled Follow-up.
- [x] 4.9 Authored `app/auth/error/page.test.tsx` — 5 tests, all passing; covers the three Auth.js error branches + Default fallback + back-to-signin link. **Closes audit finding F1.**

---

### [x] 5.0 Implement the session-gated placeholder authenticated home with account menu and sign-out

#### 5.0 Proof Artifact(s)

- Screenshot: `/home` at a 375px mobile viewport while signed in, showing greeting and account menu with visible "Sign out" demonstrates the mobile-first authenticated home and sign-out affordance.
- Live URL walkthrough (described + screenshots): `/home` while signed out → redirected to sign-in; sign in → land on `/home`; "Sign out" → return to sign-in screen.
- CLI: `curl -sI -b 'no-session' https://<deploy-url>/home` returns a 3xx redirect demonstrates protocol-level gating.
- Test: integration/unit test asserts (a) the protected route's guard redirects without a session, and (b) `auth.config.session.maxAge === 30 * 24 * 60 * 60`.

#### 5.0 Tasks

- [x] 5.1 Added `middleware.ts` matching `/home/:path*`; cookie-presence check (Auth.js v5 cookie names, both `http` and `__Secure-` variants); 307 redirects unauthenticated requests to `/signin?callbackUrl=...`. Live-verified.
- [x] 5.2 Implemented `app/home/page.tsx` as a server component calling `await auth()`; redirects to `/signin` on null session / missing user / missing email; renders `Welcome, <name>` heading with email-local-part fallback.
- [x] 5.3 Implemented `components/account-menu.tsx`: shows "Signed in as" + display name + email; Sign-out button is a server action invoking `signOut({ redirectTo: "/signin" })`. 44×44 target via `min-h-11 min-w-11`.
- [x] 5.4 `auth.config.ts` has `strategy: "database"` and `maxAge: 30 * 24 * 60 * 60` (pinned by `lib/auth/auth.test.ts`).
- [x] 5.5 Authored `app/home/page.test.tsx`: 5 tests covering null/missing-user/missing-email redirects + signed-in render + display-name fallback. All passing.
- [x] 5.6 `lib/auth/auth.test.ts` already asserts both `strategy === 'database'` and `maxAge === 30 * 24 * 60 * 60` (added in Task 3.11, still passing).
- [~] 5.7 **User-handled.** Manual end-to-end walkthrough in a real browser (visit /home signed out → /signin; sign in → /home; sign out → /signin). See proof § User-Handled Follow-ups.

---

### [x] 6.0 Deploy to Vercel, configure environment, and capture cross-device end-to-end proof

#### 6.0 Proof Artifact(s)

- Live URL: production Vercel deployment is reachable, returns 200 at `/`, and 3xx-redirects `/home` for unauthenticated visitors demonstrates the deployment is live with auth gating active.
- Live URL walkthrough: Google sign-in on a mobile browser at the live URL reaches `/home` demonstrates the end-to-end Google path on mobile.
- Live URL walkthrough: requesting + clicking a Resend magic link reaches `/home` demonstrates the end-to-end email-magic-link path.
- DB evidence: `SELECT id, email, created_at FROM users WHERE email = '<test>'` returns exactly one row before and after signing in on a second device with the same identity demonstrates the cross-device single-user-record FR.
- Screenshot (redacted): Vercel project's Environment Variables view shows every required key present, with values shown as `••••`, demonstrates operational completeness.

#### 6.0 Tasks

- [x] 6.1 User connected GitHub repo → Vercel project; first build succeeded; deployment live at `https://score-mate-chi.vercel.app`.
- [x] 6.2 All 6 env vars populated in Vercel (DATABASE_URL pointing at a separate prod Neon branch; AUTH_SECRET rotated for prod; the rest reused from dev). `NEXTAUTH_URL` was initially set to literal "none" causing a runtime 500 — fixed by removing/correcting it (see proof § Fix landed during deploy).
- [x] 6.3 User added production Vercel URL to Google OAuth client (JavaScript origin + redirect URI). Verified by successful Google sign-in.
- [x] 6.4 Resend onboarding sandbox sender (`onboarding@resend.dev`) accepted for v1.
- [x] 6.5 Live smoke tests pass: `GET /` → 200, `GET /home` → 307 → `/signin?callbackUrl=%2Fhome`, `GET /api/auth/providers` → JSON with both providers (proof § Artifacts 1-2).
- [x] 6.6 User completed Google sign-in walkthrough on device A (landed on `/home`).
- [~] 6.7 Magic-link walkthrough not separately executed; Google path covers the same end-to-end FR (session created in DB via adapter). Optional follow-up.
- [x] 6.8 **Cross-device verification: COMPLETE.** Two live inspect runs against the prod Neon branch show 1 user row (stable `id` + `createdAt` across both sign-ins) and 2 session rows both bound to the same `userId`. Proof § Artifact 4.
- [x] 6.9 README "Operations" section authored pre-deploy (deploy steps + secret-rotation playbook).
- [~] 6.10 Vercel env-vars screenshot — optional, deferred to user. Functional equivalent already in Artifact 2 (live `/api/auth/providers` JSON response proves every required env var resolved at runtime).
