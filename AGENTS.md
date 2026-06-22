<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Repo Conventions

These conventions are authoritative for any agent or human working in this repo. They are referenced from the SDD specs under `docs/specs/`.

## Stack & layout

- **Framework:** Next.js 16, App Router only. Server components by default; mark client components explicitly with `"use client"`.
- **Language:** TypeScript with `strict` enabled. No `any`. No `@ts-ignore` / `@ts-expect-error` without a tracked TODO.
- **Styling:** Tailwind CSS v4. Mobile-first: default utility classes target small screens; `sm:`, `md:`, `lg:` modifiers only layer adjustments for larger viewports.
- **Full-height layouts:** use `min-h-dvh` (not `min-h-screen`); respect safe-area insets via `env(safe-area-inset-*)`.
- **Touch targets:** primary interactive elements meet ≥44×44 px (Tailwind `min-h-11 min-w-11` works since `h-11` = 2.75rem ≈ 44px).
- **ORM:** Drizzle ORM. Schemas in `db/schema/`, migrations in `db/migrations/`. Apply migrations with `pnpm db:migrate`.
- **Auth:** Auth.js (NextAuth v5) with Drizzle adapter; database session strategy (not JWT); Google OAuth + Resend email magic link.

## File organization

```
app/                  # Next.js App Router routes, layouts, route handlers
  api/                # Route handlers (server-side)
components/           # Shared UI components
lib/                  # Shared logic (auth helpers, env validation, utilities)
db/
  schema/             # Drizzle schemas
  migrations/         # Generated SQL migrations (committed)
scripts/              # Operational scripts (e.g. db-migrate.ts)
docs/specs/           # SDD specs, task lists, audits, proofs
.github/workflows/    # CI
```

## Quality gates

- ESLint (Next.js + Prettier-compat) — run via `pnpm lint`.
- Prettier — `pnpm format` to write, `pnpm format:check` to verify.
- TypeScript — `pnpm typecheck` must pass.
- Vitest + React Testing Library — colocated tests (`foo.tsx` next to `foo.test.tsx`). Run `pnpm test:ci` in CI.
- All of the above run on every PR via `.github/workflows/ci.yml`.

## Commit conventions

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`). Enforced via `commitlint` in CI.
- Reference the relevant SDD task and spec in the commit body when applicable, e.g. `Related to T1.5 in Spec 01-spec-auth-foundation`.

## Environment variables

- Configuration lives in `process.env`. The canonical list is `.env.example` (checked in; values empty).
- Never commit `.env.local` or any file containing real secrets.
- Validate env vars at startup via `lib/env.ts` (added in Task 2.0).

## SDD workflow

- Specs, tasks, audits, and proofs live in `docs/specs/[NN]-spec-[name]/`.
- Don't pull future-spec scope into earlier specs. For example, the placeholder authenticated home in `01-spec-auth-foundation` Task 5.0 must **not** include favorites/score-tracker UI — that's `02-spec-score-tracker`'s job.
