# ScoreMate

Mobile-first personal sports score-tracker web app. Sign in, favorite teams / sports / leagues / events, see what played yesterday, is playing today, and is coming tomorrow — all on one glance-able page.

- Spec: [`docs/specs/01-spec-auth-foundation/01-spec-auth-foundation.md`](docs/specs/01-spec-auth-foundation/01-spec-auth-foundation.md) — auth + database foundation (this stage).
- Spec: [`docs/specs/02-spec-score-tracker/02-spec-score-tracker.md`](docs/specs/02-spec-score-tracker/02-spec-score-tracker.md) — favorites + homepage (next stage).

## Stack

- Next.js 16 (App Router) + TypeScript (`strict`)
- Tailwind CSS v4, mobile-first
- Neon Postgres + Drizzle ORM (wired in Task 2.0)
- Auth.js (NextAuth v5) — Google OAuth + Resend email magic link (wired in Task 3.0)
- Vitest + React Testing Library
- ESLint (Next.js + Prettier-compat) + Prettier
- Conventional Commits (via commitlint)
- Deploys on Vercel

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in values (see "Environment" below)
pnpm dev                     # http://localhost:3000
```

## Scripts

| Script              | What it does                                 |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Run the Next.js dev server.                  |
| `pnpm build`        | Production build.                            |
| `pnpm start`        | Serve the production build.                  |
| `pnpm lint`         | Lint via ESLint (Next.js + Prettier-compat). |
| `pnpm typecheck`    | `tsc --noEmit`.                              |
| `pnpm test`         | Vitest in watch mode.                        |
| `pnpm test:ci`      | Vitest single run (used in CI).              |
| `pnpm format`       | Format the repo with Prettier.               |
| `pnpm format:check` | Fail if anything is not Prettier-formatted.  |

## Environment

All configuration lives in `process.env`. Copy `.env.example` to `.env.local` and fill it in. Required keys (documented inline in `.env.example`):

- `DATABASE_URL` — Neon Postgres connection string.
- `AUTH_SECRET` — Auth.js secret (`openssl rand -base64 32`).
- `NEXTAUTH_URL` — canonical app URL (defaults to `http://localhost:3000` in dev).
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — Google OAuth client credentials.
- `AUTH_RESEND_KEY` — Resend API key.
- `EMAIL_FROM` — Verified sender for magic-link emails.

Never commit `.env.local`. It's already in `.gitignore`.

## Database

Neon Postgres + Drizzle ORM. Schemas live in `db/schema/`; generated migrations live in `db/migrations/`.

**Local setup:**

1. Create a Neon project at [console.neon.tech](https://console.neon.tech) (one production branch is enough for now; a separate `dev` branch is recommended for local work).
2. Copy the connection string from **Connection Details → Pooled connection** and paste it into `.env.local` as `DATABASE_URL`.
3. Run migrations:

   ```bash
   pnpm db:migrate
   ```

**Drizzle commands:**

| Command            | What it does                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:generate` | Diff schemas in `db/schema/` against the existing migrations and emit a new SQL migration file. Commit the generated file. |
| `pnpm db:migrate`  | Apply all pending migrations against `DATABASE_URL`. Run before `pnpm dev` after pulling new migrations.                   |
| `pnpm db:studio`   | Open Drizzle Studio (browser GUI) against `DATABASE_URL`.                                                                  |

The migrator uses the standard `postgres` driver; the runtime app uses the Neon serverless HTTP driver (`db/index.ts`). Both read `DATABASE_URL` from the environment.

## Operations

### Release notes

- **2026-06-24 — Provider swap (Spec 03):** the data backend moved from TheSportsDB to ESPN. Migration `0003_reset_favorites_for_espn.sql` truncates the `favorites` table on deploy (Spec 03 Q4 (D) — no production users yet); users re-favorite from the new ESPN-backed search. Tennis is dropped from the supported-sports set in v1.
- **2026-06-24 — Baseball support (Spec 04):** MLB and NCAA D-I baseball join the supported-sports set. The ESPN catalog is refreshed to include all baseball teams, and the homepage cache prefix is bumped from `v5-espn-shortname` to `v6-espn-baseball` so the deploy invalidates the prior keyspace.
- **2026-06-25 — Tennis support (Spec 05):** Grand Slams + ATP/WTA 1000 marquee tournaments (23 total) join the supported-sports set. Tennis tournaments appear in the favorites typeahead and the homepage mixed feed. The homepage cache prefix is bumped to `v7-espn-tennis` as the deploy invalidation mechanism.

### Deploy to Vercel

1. **Push the repo to GitHub.** Vercel pulls from there.
2. **Create a Vercel project** at [vercel.com/new](https://vercel.com/new), import the GitHub repo. Vercel auto-detects Next.js; no build-command overrides needed.
3. **Set environment variables** in **Project → Settings → Environment Variables**. Add every key from `.env.example`, scoped to **Production**, **Preview**, and **Development** (or at least Production + Preview):

   | Key                  | Where to get it                                                                   | Notes                                                                        |
   | -------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
   | `DATABASE_URL`       | Neon → Connection Details → Pooled connection                                     | Use the same Neon project as local; production traffic shares this DB.       |
   | `AUTH_SECRET`        | `openssl rand -base64 32` (generate a fresh one for prod)                         | Don't reuse the dev secret.                                                  |
   | `NEXTAUTH_URL`       | `https://<your-vercel-project>.vercel.app`                                        | Match the canonical production domain.                                       |
   | `AUTH_GOOGLE_ID`     | Google Cloud Console → your OAuth client                                          | Same client can serve dev + prod once you add prod redirect URI (see below). |
   | `AUTH_GOOGLE_SECRET` | Google Cloud Console → same OAuth client                                          |                                                                              |
   | `AUTH_RESEND_KEY`    | Resend → API Keys                                                                 | Same key works for both envs.                                                |
   | `EMAIL_FROM`         | `onboarding@resend.dev` for sandbox, or `noreply@<your-verified-domain>` for prod | The sandbox sender only delivers to your own signup address.                 |

4. **Add the Vercel production URL to your Google OAuth client.** In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID:
   - Authorized JavaScript origins: add `https://<your-vercel-project>.vercel.app`
   - Authorized redirect URIs: add `https://<your-vercel-project>.vercel.app/api/auth/callback/google`

5. **Apply database migrations to the production DB.** Drizzle migrations aren't auto-applied on deploy. After your first deploy (or any deploy that includes new SQL files under `db/migrations/`), run locally with the **production** `DATABASE_URL` set:

   ```bash
   DATABASE_URL="<prod-connection-string>" pnpm db:migrate
   ```

   Alternatively, swap `.env.local` temporarily.

6. **Deploy.** Push to `main` (or click "Deploy" in Vercel). The build runs `pnpm install --frozen-lockfile && pnpm build`. CI from `.github/workflows/ci.yml` still runs lint/typecheck/test on every PR.

7. **Smoke test the deployed URL:**

   ```bash
   curl -sI https://<your-vercel-project>.vercel.app/        # expect 200
   curl -sI https://<your-vercel-project>.vercel.app/home    # expect 307 → /signin
   ```

### Rotating secrets

| Secret               | How to rotate                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`        | Generate new value (`openssl rand -base64 32`), update in Vercel env vars, redeploy. **All existing sessions are invalidated** (users must sign in again). |
| `AUTH_GOOGLE_SECRET` | Reset in Google Cloud Console → your OAuth client. Update in Vercel env vars, redeploy. Sessions remain valid; sign-in flows use the new secret.           |
| `AUTH_RESEND_KEY`    | Revoke + regenerate in Resend → API Keys. Update in Vercel env vars, redeploy.                                                                             |
| `DATABASE_URL`       | Rotate the Neon role password in Neon → Roles. Update in Vercel env vars, redeploy. **Brief downtime** as old connections are dropped.                     |

## Repo Conventions

See [`AGENTS.md`](AGENTS.md) for the authoritative list. Highlights:

- TypeScript `strict`; no `any`; no untracked `@ts-ignore`.
- Tailwind mobile-first: default classes target small screens; use `sm:`/`md:`/`lg:` only for upward adjustments.
- Use `min-h-dvh` (not `min-h-screen`) for full-height layouts; respect safe-area insets on notched devices.
- Tests colocated with the code they test (`foo.tsx` next to `foo.test.tsx`).
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`); enforced via commitlint in CI.
