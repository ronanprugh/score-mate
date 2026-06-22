# 01-audit-auth-foundation.md

## Executive Summary

- Overall Status: **PASS** (Run 2 — both advisory FLAGs cleared after approved remediation)
- Required Gate Failures: **0**
- Flagged Risks: **0** (down from 2 in Run 1)

This is a greenfield repository: no `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `package.json`, or CI workflow files exist yet. Standards confidence is therefore LOW, but the gap is intentionally **closed by Task 1.0**, which authors `README.md`, `AGENTS.md`, `.env.example`, the lint/format/commit configs, and the CI workflow as part of the very first parent task. Future specs in this repo will have an authoritative non-spec standards source as soon as Task 1.0 ships.

## Gate Overview

| Gate | Status | Notes |
| --- | --- | --- |
| Requirement-to-test traceability (REQUIRED) | PASS | Every FR in the spec maps to ≥1 task and ≥1 planned test artifact (screenshot, CLI output, unit test, or DB query). See FR↔Task map below. |
| Proof artifact verifiability (REQUIRED) | PASS | All artifacts name a concrete observable (specific URL, command, file path, viewport size, DB query, or test file). No "works as expected" language. |
| Repository standards consistency (REQUIRED) | PASS (with caveat) | Only one standards source exists today (the spec itself); no conflicts. Greenfield gap is addressed by Task 1.0 (creates `AGENTS.md` + `README.md`). Recorded in the Standards Evidence Table. |
| Open question resolution (REQUIRED) | PASS | Spec's Open Questions section states "No blocking open questions"; resolved items from the questions round are baked into the spec. |
| Regression-risk blind spots (FLAG) | CLEARED | Resolved by sub-task 4.9 + `app/(auth)/error/page.test.tsx`. |
| Non-goal leakage (FLAG) | CLEARED | Resolved by explicit guardrail note under § Notes. |

## Standards Evidence Table

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | not found | — (greenfield; will be created in Task 1.9) | none |
| `README.md` | not found | — (greenfield; will be created in Task 1.8) | none |
| `CONTRIBUTING.md` | not found | — | none |
| `.github/pull_request_template.md` | not found | — | none |
| `package.json` | not found | — (greenfield; will be created in Task 1.1) | none |
| Lint/format/CI configs | not found | — (greenfield; will be created in Tasks 1.4, 1.6, 1.10) | none |
| `01-spec-auth-foundation.md` § Repository Standards | yes | TS `strict`; Next.js App Router; Tailwind mobile-first; Drizzle ORM (`db/schema/`, `db/migrations/`); pnpm preferred; ESLint + Prettier in CI; Conventional Commits; `.env.example` mandatory | none |
| `01-spec-auth-foundation.md` § Technical Considerations | yes | Auth.js v5 (Google + Email/Resend); Drizzle adapter; Neon serverless Postgres; explicit env-var contract; GitHub Actions CI (`lint`, `typecheck`, `build`); 30-day `session.maxAge`; `min-h-dvh`; safe-area insets | none |

## FR ↔ Task Coverage Map (Required-Gate Evidence)

Compact mapping of each functional requirement to its implementing task(s) and planned test artifact(s).

### Unit 1 — Project Scaffold & Database

| FR | Tasks | Test/Proof Artifact |
| --- | --- | --- |
| Next.js 15+ App Router + TS `strict` | 1.1 | 1.0 CLI artifact (`pnpm typecheck`), file diff of `tsconfig.json` |
| Tailwind mobile-first | 1.2, 1.3 | 1.0 screenshot at 375px |
| Vercel-deployable | 6.1, 6.5 | 6.0 live URL artifact |
| `/` renders correctly at 375px (no horiz scroll) | 1.3 | 1.0 mobile-viewport screenshot |
| Neon connection via `DATABASE_URL` | 2.1, 2.3, 2.8 | 2.0 smoke test (`db/smoke.test.ts`) |
| Drizzle schema/migrations dir layout | 2.4, 2.5 | 2.0 file-diff artifact |
| `pnpm db:migrate` script applies migrations | 2.6, 2.7, 2.10 | 2.0 CLI artifact |
| `.env.example` committed | 1.7, 3.8 | 1.0 file diff |
| ESLint + Prettier pass in CI | 1.4, 1.10 | 1.0 CI run artifact |

### Unit 2 — Authentication

| FR | Tasks | Test/Proof Artifact |
| --- | --- | --- |
| Auth.js v5 with Google + Email (Resend) | 3.1, 3.5 | 3.0 CLI (`/api/auth/providers`), `lib/auth/auth.test.ts` |
| Database session strategy via Drizzle adapter | 3.2, 3.3, 3.4, 3.5 | 3.0 `psql \dt` artifact, `lib/auth/auth.test.ts` asserts strategy |
| Mobile-first sign-in screen, both CTAs | 4.1, 4.2, 4.3 | 4.0 mobile screenshot, `signin/page.test.tsx` asserts both CTAs |
| Single `users` row per identity, reused on subsequent sign-ins | 3.5 (Auth.js adapter behavior) | 6.8 DB query proof (before/after second-device sign-in) |
| Session ≥30 days, survives reload/tab-close | 3.5 (config), 5.4 (verify) | `lib/auth/auth.test.ts` asserts `maxAge === 30*24*60*60` (Tasks 3.11, 5.6) |
| Protected route redirect for unauthenticated visitors | 5.1 | 5.0 `curl -sI` artifact, `home/page.test.tsx` redirect assertion |
| "Sign out" control on authenticated route | 5.2, 5.3 | 5.0 mobile screenshot, manual walkthrough (5.7) |
| Magic-link email, 24h expiry, single-use (Auth.js default) | 3.5 (Auth.js default), 6.7 | 6.0 walkthrough artifact |
| "Check your email" confirmation state | 4.4 | 4.0 screenshot, `signin/page.test.tsx` transition assertion |
| Non-technical error states | 4.5 | 4.0 error-state screenshot |

## Findings

### REQUIRED Failures

_None._

### FLAG Findings

#### F1. Regression-risk blind spot: only happy-path tests are planned for the sign-in flow

- **Risk:** The planned `signin/page.test.tsx` and `home/page.test.tsx` cover the success transition and the unauthenticated-redirect path, but there is no planned automated test that drives an Auth.js error-callback URL (e.g. `?error=Verification`) into `app/(auth)/error/page.tsx`. The error UX is verified only by a manual screenshot in Task 4.8. If the error-mapping logic regresses, no test will catch it.
- **Suggested remediation:** add a sub-task **4.9** to `app/(auth)/error/page.test.tsx` covering the three error-param branches: `OAuthCallback`, `Verification`, `EmailSignin`. Asserts that each renders a distinct non-technical message.

#### F2. Non-goal leakage risk: nothing forbids accidental scope creep beyond the placeholder home

- **Risk:** Task 5.2's "placeholder authenticated home" is intentionally minimal, but a developer working on it could easily start adding favorites/score-tracker UI ahead of `02-spec-score-tracker`. There's no explicit guardrail in the tasks file pointing this out.
- **Suggested remediation:** add a one-line note in the "Notes" section under Relevant Files (or as a leading comment in Task 5.0) reminding implementers that the home is a placeholder; favorites + score features belong to `02-spec-score-tracker`.

## User-Approved Remediation Plan

- **Status: Approved (user response "1 please") and Completed (Run 2).**

Edits applied:

1. **F1 fix** — sub-task `4.9` added; `4.0 Proof Artifact(s)` extended with the new test artifact; `app/(auth)/error/page.test.tsx` added to the Relevant Files table.
2. **F2 fix** — note added under § Notes: "Task 5.0's authenticated home is intentionally a placeholder. Favorites, the score-tracker homepage, and any sports-data UI belong to 02-spec-score-tracker — do not pull that scope forward."

## Re-Audit Delta (Run 2)

- Changed gate statuses since previous run:
  - **Regression-risk blind spots:** FLAG → **CLEARED** (sub-task 4.9 and the new test file provide automated coverage for all three error-param branches).
  - **Non-goal leakage:** FLAG → **CLEARED** (explicit guardrail note prevents `02-spec-score-tracker` scope creep into Task 5.0).
- Still-failing REQUIRED gates: **none**.
- Newly introduced findings: **none**.
- Final status: **PASS — all REQUIRED gates pass; all advisory FLAGs cleared.**

## Chain-of-Verification Check

1. **Initial assessment:** all four REQUIRED gates evaluated against the spec, tasks file, and the (greenfield-empty) standards search.
2. **Self-question:** *"Do all REQUIRED gates pass with explicit evidence?"* — Yes; the FR↔Task map provides line-item evidence; the Standards Evidence Table records the greenfield state and the in-task remediation (Task 1.0).
3. **Fact-checking:** spot-checked five FRs (single-row identity, 30-day session, `/home` redirect, magic-link expiry, `.env.example`) — all map to listed tasks and named test artifacts.
4. **Inconsistency resolution:** none required.
5. **Final synthesis:** Status = **PASS**. Two FLAGs above are advisory.
