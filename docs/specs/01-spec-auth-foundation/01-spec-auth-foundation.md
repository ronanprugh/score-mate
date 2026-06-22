# 01-spec-auth-foundation.md

## Introduction/Overview

This spec sets up the authentication and account-storage foundation for ScoreMate, a mobile-first personal sports score-tracker web app. It is intentionally scoped to just the plumbing: a signed-in user identity, a database to own that identity, and the session machinery needed by every subsequent feature. The follow-up spec ([02-spec-score-tracker](../02-spec-score-tracker/02-spec-score-tracker.md)) builds the favoriting and homepage features on top of this foundation.

> **Context note:** This spec and `02-spec-score-tracker` were originally drafted as a single spec and then split on user request. The shared clarifying-questions file lives at [01-questions-1-auth-foundation.md](./01-questions-1-auth-foundation.md) and applies to both.

## Goals

- Stand up a Next.js (App Router) + TypeScript + Tailwind CSS project on Vercel with a mobile-first responsive baseline.
- Provide sign-up and sign-in for end users via Google OAuth and email magic links, with sessions that persist across reloads and devices for at least 30 days.
- Provision a managed Postgres database (Neon) wired to the app via Drizzle ORM, with checked-in schema and migrations.
- Make the foundation immediately usable by gating a placeholder "Home" route behind authentication so that auth correctness can be demonstrated end-to-end.
- Establish repository conventions (TypeScript strict, ESLint + Prettier, Conventional Commits, `.env.example`) that the score-tracker spec will inherit unchanged.

## User Stories

- **As a new visitor**, I want to sign up with one click via Google so that I can start using the app without creating yet another password.
- **As a privacy-conscious visitor**, I want to sign up with my email via a magic link so that I don't need a Google account to use the app.
- **As a returning user**, I want my sign-in session to last across days and devices so that I'm not re-authenticating every time I open the app.
- **As a user finished for the moment**, I want a clearly visible "Sign out" control so that I can end my session when I'm on a shared device.
- **As any visitor**, I want unauthenticated access to protected pages to redirect me to sign-in so that the app's state is never ambiguous about who I am.
- **As a user on my phone**, I want the sign-in screen and signed-in placeholder home to look and feel native to a small touch screen so that the app is comfortable on the device I actually use.

## Demoable Units of Work

### Unit 1: Project Scaffold & Database

**Purpose:** Get the empty-but-deployable shell in place so every later piece of work has a real, mobile-first home to land in.

**Functional Requirements:**

- The system shall be a Next.js 15+ App Router project written in TypeScript with `strict` mode enabled.
- The system shall use Tailwind CSS for styling, configured mobile-first (default styles target small screens; `sm:` / `md:` / `lg:` breakpoints layer on larger-screen adjustments).
- The system shall be deployable to Vercel with no manual build steps beyond `vercel deploy` (or a connected Git integration).
- The system shall expose a public landing route (`/`) that renders correctly on a 375px-wide viewport without horizontal scroll.
- The system shall connect to a Neon Postgres database using a connection string supplied via the `DATABASE_URL` environment variable.
- The system shall use Drizzle ORM with schema files under `db/schema/` and migrations committed under `db/migrations/`.
- The system shall include a `pnpm db:migrate` (or equivalent npm script) command that applies pending migrations against the configured `DATABASE_URL`.
- The system shall ship a `.env.example` documenting every required environment variable name with empty values.
- The system shall pass ESLint (Next.js default config) and Prettier with no errors in CI.

**Proof Artifacts:**

- Screenshot: the deployed landing page at the live Vercel URL viewed at a 375px mobile viewport demonstrates the mobile-first baseline.
- Screenshot: the deployed landing page at a 1280px desktop viewport demonstrates responsive layering also works.
- CLI output: `pnpm db:migrate` (or equivalent) succeeds against a fresh Neon database demonstrates the migration tooling works end-to-end.
- Repository link: the public Git repo with `.env.example`, Drizzle schema, and a passing CI run demonstrates the conventions are in place.

### Unit 2: Authentication (Google + Email Magic Link)

**Purpose:** Let real users prove who they are and have the app remember them. This is the smallest end-to-end auth flow that supports the favorites work in the next spec.

**Functional Requirements:**

- The system shall integrate Auth.js (NextAuth v5) configured with the Google provider and the Email (magic link) provider, backed by Resend for transactional email delivery.
- The system shall use Auth.js's database session strategy via the Drizzle adapter so that users, accounts, sessions, and verification tokens persist in the Neon Postgres database.
- The system shall render a mobile-first sign-in screen with two primary calls to action: "Continue with Google" and "Continue with Email" (email input + send button).
- The system shall create exactly one `users` row on first successful sign-in for a given identity (matched by provider account ID for OAuth and by verified email address for magic link) and reuse that row on subsequent sign-ins from the same identity.
- The system shall issue a session that survives full page reloads and tab closes for at least 30 days, until the user signs out.
- The system shall protect a placeholder authenticated route (e.g. `/home`) such that unauthenticated visitors are redirected to the sign-in screen.
- The system shall expose a "Sign out" control reachable from the authenticated route (e.g. inside an account menu); activating it ends the session and returns the user to the public landing or sign-in screen.
- The system shall render the magic-link email with a clear sender name and a single primary link/button; the link shall expire after Auth.js's default verification-token lifetime (24 hours) and be single-use.
- The system shall display a clear "Check your email" confirmation state after a magic link is requested.
- The system shall display a clear, non-technical error state if the OAuth flow is canceled, the magic link is expired/already-used, or the email provider fails to send.

**Proof Artifacts:**

- Screenshot: the sign-in screen at a 375px mobile viewport demonstrates the mobile-first auth entry point exists.
- Screenshot: the signed-in placeholder home with the account menu visible, captured at a 375px mobile viewport, demonstrates that sign-in completes and produces a session on mobile.
- Live URL walkthrough: signing in on one device (mobile browser), then opening the same URL on a second device (desktop browser) and signing in there with the same identity, demonstrates per-user identity is correctly scoped and reused across devices.
- Screenshot: the "Check your email" state after requesting a magic link demonstrates the email flow's user-facing feedback.
- Live URL walkthrough: clicking "Sign out" from the authenticated route and being redirected back to the public sign-in screen demonstrates the session-end flow.

## Non-Goals (Out of Scope)

1. **No favorites or score-tracking features** — those belong to [02-spec-score-tracker](../02-spec-score-tracker/02-spec-score-tracker.md). The placeholder authenticated route exists only to prove auth gates work.
2. **No password-based authentication** — only Google OAuth and email magic links are supported.
3. **No additional OAuth providers** in v1 (no Apple, GitHub, Facebook, Microsoft, etc.).
4. **No account settings UI** — no profile editing, no avatar upload, no display-name change. Account data is whatever the OAuth provider returns; magic-link users get email-derived defaults.
5. **No account deletion flow** in v1; if needed, the user contacts the developer.
6. **No multi-factor authentication** in v1.
7. **No role-based access control or admin features**; every authenticated user has the same permissions (their own data only).
8. **No native mobile app** — mobile-first responsive web only.
9. **No internationalization**; English-only copy.
10. **No analytics or telemetry** beyond Vercel's built-in deployment telemetry.

## Design Considerations

- **Mobile-first is a hard requirement.** Every screen in this spec must be designed and verified at a ~375px-wide viewport first; larger viewports are progressive enhancements.
- Touch targets must be at least 44×44 CSS px (Apple HIG / WCAG 2.5.5 Level AAA-aligned target size) for primary actions (sign-in buttons, sign-out, magic-link send).
- The sign-in screen should feel like a single-purpose mobile page: vertically stacked, generous spacing, full-width primary buttons.
- The placeholder authenticated home can be visually minimal — a greeting, an account menu, and a "Sign out" affordance are sufficient.
- No design mockups exist; implementation should follow conventional mobile-web auth patterns (e.g., one column, sticky-safe top spacing for notched devices) and Tailwind defaults.

## Repository Standards

This is a greenfield project; this spec establishes the standards that all later specs inherit.

- **Language:** TypeScript in `strict` mode for all application code.
- **Framework:** Next.js App Router conventions (`app/` directory, server components by default, client components only where interactivity requires them).
- **Styling:** Tailwind CSS, mobile-first; no parallel CSS-in-JS or external CSS modules.
- **ORM:** Drizzle ORM; schemas in `db/schema/`, migrations in `db/migrations/`.
- **File organization:** route-specific UI colocated under `app/`; shared UI under `components/`; shared logic under `lib/`; database schema under `db/`; Auth.js config under `auth.ts` or `lib/auth/`.
- **Package manager:** `pnpm` is recommended for Vercel compatibility, but `npm` is acceptable; whichever is chosen, only one lockfile is committed.
- **Linting/Formatting:** ESLint (Next.js default) + Prettier; CI runs both.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- **Environment:** all configuration via `process.env`; `.env.example` lists every required key with empty values.

## Technical Considerations

- **Hosting & framework:** Next.js App Router + TypeScript + Tailwind on Vercel.
- **Authentication:** Auth.js (NextAuth v5) with the Google provider and the Email (magic link) provider. Database session strategy (not JWT) so sessions can be invalidated server-side later if needed.
- **Auth.js adapter:** the Drizzle adapter so users, accounts, sessions, and verification tokens live in Neon alongside future application tables.
- **Database:** **Neon Postgres** (serverless Postgres). Use the Neon serverless driver for edge-compatible reads and the standard `pg`/`postgres` driver for migrations.
- **Email provider:** **Resend** for magic-link delivery. Use a verified sending domain or Resend's onboarding sandbox for v1; switch to a verified domain before public launch.
- **Initial schema (managed by Auth.js Drizzle adapter, but committed to this repo):**
  - `users` (`id`, `email`, `name`, `image`, `emailVerified`, `created_at`)
  - `accounts` (Auth.js account-linking table for OAuth)
  - `sessions` (Auth.js session table)
  - `verification_tokens` (Auth.js magic-link tokens)
- **Mobile-first build conventions:**
  - Default Tailwind classes target small screens; `sm:`, `md:`, `lg:` modifiers introduce larger-screen adjustments.
  - Use `min-h-dvh` (dynamic viewport height) over `min-h-screen` for full-height layouts to handle mobile browser chrome correctly.
  - Add `viewport-fit=cover` and respect safe-area insets via `env(safe-area-inset-*)` for notched devices.
- **Required environment variables:**
  - `DATABASE_URL` (Neon connection string)
  - `AUTH_SECRET` (Auth.js secret; generate via `openssl rand -base64 32`)
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (Google OAuth client)
  - `AUTH_RESEND_KEY` (Resend API key)
  - `EMAIL_FROM` (verified sender address, e.g. `noreply@<your-domain>`)
  - `NEXTAUTH_URL` (canonical app URL; Vercel sets `VERCEL_URL` automatically but a stable canonical URL is preferred)
- **CI:** GitHub Actions running `pnpm install`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` on every PR.
- **Testing:** unit tests for any non-trivial auth helper logic (e.g., redirect-after-sign-in target resolution). E2E tests deferred per the user's proof-artifact choice.

## Security Considerations

- **Secrets management:** all secrets (Google client secret, Resend API key, Neon connection string, `AUTH_SECRET`) live only in Vercel environment variables and the developer's local `.env.local`; they are never committed. `.env.local` is in `.gitignore` by default.
- **Auth.js session cookies:** `httpOnly`, `secure` in production, `sameSite=lax` (Auth.js defaults are appropriate).
- **CSRF:** Auth.js handles CSRF for auth routes out of the box.
- **OAuth redirect URIs:** Google OAuth client must whitelist the production Vercel URL and `localhost:3000` only; preview deployments use wildcard redirect URIs only if explicitly intended.
- **Magic-link token security:** Auth.js verification tokens are single-use and expire (default 24 hours). Tokens are stored hashed in the database.
- **Email content:** magic-link emails must not include any user-identifying information beyond what the user themselves provided.
- **Database access:** the app role used in `DATABASE_URL` has only the privileges it needs (no superuser); separate migration credentials may be used.
- **No client-leaked secrets:** verify before each deploy that nothing sensitive is exposed via `NEXT_PUBLIC_*` env vars.
- **Proof artifact hygiene:** screenshots used for proof must not include real OAuth tokens, real session cookies, or full personal email addresses — use a test account, and redact email addresses to `t***@example.com` format when capturing.

## Success Metrics

1. **End-to-end sign-in path works:** a fresh user can complete Google sign-in or email magic-link sign-in and reach the placeholder authenticated home in under 60 seconds on a mobile device — 100% target on a successful path.
2. **Cross-device session reuse:** signing in on a second device with the same identity reuses the same `users` row (verifiable via a DB query) — 100% target.
3. **Mobile-first compliance:** the sign-in screen and placeholder authenticated home render correctly with no horizontal scroll and ≥44px touch targets at 375px width — 100% target via manual inspection.
4. **Session longevity:** a session created today is still valid 30 days later without re-authentication, assuming no manual sign-out — verified by configuration and one long-running observation.
5. **CI green:** lint, typecheck, and build pass on every PR — 100% target.

## Open Questions

No blocking open questions at this time. Email-from domain verification (Resend) and the production Google OAuth client setup are operational items that will be handled during implementation, not spec questions.
