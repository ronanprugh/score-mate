# 02-audit-score-tracker.md

## Executive Summary

- Overall Status: **PASS** (Run 2 — both advisory FLAGs cleared after approved remediation)
- Required Gate Failures: **0**
- Flagged Risks: **0** (down from 2 in Run 1)

## Gate Overview

| Gate | Status | Notes |
| --- | --- | --- |
| Requirement-to-test traceability (REQUIRED) | PASS | Every spec FR (9 Unit-1 + 13 Unit-2) maps to ≥1 task and ≥1 planned test artifact. See FR↔Task map below. |
| Proof artifact verifiability (REQUIRED) | PASS | All artifacts name a concrete observable (specific path, command, viewport size, fixture, or test file). No vague "works as expected" language. |
| Repository standards consistency (REQUIRED) | PASS | 7 standards sources read (`AGENTS.md`, `README.md`, `CLAUDE.md`, `.github/workflows/ci.yml`, `package.json`, spec-01 § Repository Standards, spec-02 §§ Repository Standards + Technical Considerations). Zero conflicts. Standards confidence: HIGH. |
| Open question resolution (REQUIRED) | PASS | Spec's Open Questions section states "No blocking open questions at this time"; the only noted refinement (TheSportsDB league-id mappings) is explicitly scoped as a repo-level adjustment during implementation, not a spec-level question. |
| Regression-risk blind spots (FLAG) | CLEARED | Resolved by sub-task 2.14 (cross-user DELETE test). |
| Non-goal leakage (FLAG) | CLEARED | Resolved by sub-task 1.11 (Sport-favorite allowlist end-to-end assertion). |

## Standards Evidence Table

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | Next.js 16 App Router, TS `strict`, Tailwind v4 mobile-first, `min-h-dvh`, ≥44 px touch targets via `min-h-11 min-w-11`, Drizzle ORM, Auth.js v5 (db sessions) | none |
| `README.md` | yes | `pnpm` scripts (`lint`/`format[:check]`/`typecheck`/`test[:ci]`/`db:generate`/`db:migrate`), `.env.example` env contract, deploy + secret-rotation playbook | none |
| `CLAUDE.md` | yes | `@AGENTS.md` re-export (no additional conventions) | none |
| `.github/workflows/ci.yml` | yes | CI runs install + lint + format:check + typecheck + test:ci + build on every PR + push | none |
| `package.json` | yes | Next 16.2.9, React 19.2, drizzle-orm 0.45, next-auth 5 beta, zod 4, vitest 2, ESLint 9 (flat) | none |
| `01-spec-auth-foundation.md` § Repository Standards | yes | Inherited verbatim by spec 02 | none |
| `02-spec-score-tracker.md` §§ Repository Standards + Technical Considerations | yes | Adds: new tables in `db/schema/`, new Route Handlers in `app/api/`, new shared logic in `lib/`; TheSportsDB only server-side; client polling with visibility gating | none |

**Standards confidence: HIGH.**

## FR ↔ Task Coverage Map (Required-Gate Evidence)

Compact mapping of every spec FR to its implementing task(s) and planned test artifact(s).

### Unit 1 — Favoriting

| FR | Tasks | Test/Proof Artifact |
| --- | --- | --- |
| Mobile-first search/browse across all 4 sports / 4 favorite types | 3.5, 3.6, 3.11 | `app/(app)/favorites/page.test.tsx`; mobile screenshot |
| One-tap add + one-tap remove | 3.7, 3.9, 3.11, 3.12 | `favorites/page.test.tsx` (Add transition); `my-favorites/page.test.tsx` (Remove) |
| Persist scoped to signed-in user | 2.6, 2.8 | `app/api/favorites/route.test.ts` (scoped-create branch) |
| Reflect current state without full page reload | 3.7, 3.9 | `favorites/page.test.tsx` (optimistic transition without navigation) |
| Team / Sport / League / Event semantics | 1.5, 1.7, 1.8 | `lib/favorite-matcher.test.ts` (one assert per type) |
| Event silent-expire | 1.7, 1.8 | `lib/favorite-matcher.test.ts` (expired-event assert) |
| "My Favorites" screen with remove | 3.8, 3.12 | `my-favorites/page.test.tsx`; mobile screenshot |
| Multiple favorites of same/different types | 3.7, 3.8 | `favorites` table allows it by schema; covered by `my-favorites/page.test.tsx` |
| Empty-favorites state | 3.12 | `my-favorites/page.test.tsx` (empty-state assert); mobile screenshot |
| Duplicate prevention via UNIQUE | 2.1, 2.6 | `route.test.ts` (duplicate POST returns existing row branch); SQL `\d favorites` shows UNIQUE |

### Unit 2 — Homepage Score Tracker

| FR | Tasks | Test/Proof Artifact |
| --- | --- | --- |
| Compute [yesterday/today/tomorrow] in browser TZ | 1.9, 1.10, 5.2 | `lib/date-window.test.ts` (TZ-boundary cases) |
| Query TheSportsDB via server-side Route Handlers for window matching favorites | 1.3, 4.1, 4.3 | `app/api/home/route.test.ts` (mixed-favorites branch); `aggregator.test.ts` |
| Display matches grouped by day | 5.3, 5.8 | `home-client.test.tsx` (three day groups assert); mobile screenshot |
| Render each card with participants/competition/round/venue/kickoff | 5.4, 5.6 | `match-card.test.tsx` |
| Final / Live / Upcoming visual distinction | 5.4, 5.6 | `match-card.test.tsx` (three-branch tests); Live + Upcoming screenshots |
| Upcoming card shows broadcast/streaming when available | 5.4, 5.6 | `match-card.test.tsx` (Upcoming branch); Upcoming screenshot |
| Auto-refresh every 60 s while live present | 6.1, 6.4 | `home-client.test.tsx` polling test (a) |
| Stop auto-refresh when no live | 6.1, 6.4 | polling test (b) |
| Pause on `visibilitychange:hidden`, resume on `:visible` | 6.2, 6.4 | polling test (c) |
| Dedup across favorites | 1.7, 1.8, 4.1, 4.5 | `favorite-matcher.test.ts` (dedup case); `route.test.ts` (dedup branch) |
| Partial-failure error banner | 4.1, 4.3, 4.5, 5.5, 5.8 | `route.test.ts` (partial-failure branch); `home-client.test.tsx` (banner assert); error-banner screenshot |
| No-matches empty state | 5.5, 5.8 | `home-client.test.tsx` (empty assert); empty-state screenshot |
| Renders at 375 px with no horizontal scroll; multi-column at wider | 5.1, 5.3, 5.4 | mobile + desktop screenshots |

## Findings

### REQUIRED Failures

_None._

### FLAG Findings

#### F1. Regression-risk blind spot: rate-limit + auth-scoping behavior is only happy-path tested

- **Risk:** Task 2.0's planned tests cover the documented 6 branches (401 / scoped POST / duplicate / scoped DELETE / 400 / 429). However, the most security-sensitive case — **a signed-in user A trying to DELETE a favorite owned by user B** — is conceptually covered by the "scoped DELETE" branch but isn't called out separately in the proof or sub-task list. If a future refactor introduces an IDOR (e.g., dropping the `WHERE userId = ?` clause), the existing test could pass while the bug ships.
- **Suggested remediation:** Add explicit sub-task **2.14** to author a dedicated test case in `app/api/favorites/[id]/route.test.ts`: "Authenticated as user A, DELETE a favorite that belongs to user B → returns 404 (not 204) and the row is still present in the DB." Append a matching artifact line to the 2.0 proof: "Test: cross-user DELETE attempt returns 404 and leaves the target row intact."

#### F2. Non-goal leakage risk: "Sport favorite" semantics could quietly drift toward unbounded matches

- **Risk:** Spec § Non-Goals item 8 forbids "sport-wide 'all matches' favoriting." The implementation depends entirely on `lib/sport-allowlist.ts` returning `false` for anything outside the curated list. There's no test in the current sub-task list that asserts the matcher *rejects* a known-out-of-list league for a Sport favorite end-to-end (only `lib/sport-allowlist.test.ts` asserts the allowlist function itself). A subtle bug in `favorite-matcher.ts` could OR the Sport branch into a too-broad query.
- **Suggested remediation:** Add an assertion to `lib/favorite-matcher.test.ts` (Task 1.8): "Given a Sport favorite for Soccer and a match in a non-allowlist league (e.g. EFL Championship), the matcher returns zero matches." Append a matching line to the 1.0 proof: "Test: Sport favorite rejects out-of-allowlist leagues end-to-end."

## User-Approved Remediation Plan

- **Status: Approved (user response "1 please") and Completed (Run 2).**

Edits applied:

1. **F1 fix** — sub-task `2.14` added (cross-user DELETE test); `2.0 Proof Artifact(s)` extended with the new test artifact.
2. **F2 fix** — sub-task `1.11` added (Sport-favorite allowlist end-to-end assertion); `1.0 Proof Artifact(s)` extended with the new test artifact.

## Re-Audit Delta (Run 2)

- Changed gate statuses since previous run:
  - **Regression-risk blind spots:** FLAG → **CLEARED** (sub-task 2.14 + the cross-user DELETE test pin the auth-scoping behavior against silent IDOR regressions).
  - **Non-goal leakage:** FLAG → **CLEARED** (sub-task 1.11's end-to-end matcher test prevents "Sport favorite" from quietly broadening to "all matches in sport").
- Still-failing REQUIRED gates: **none**.
- Newly introduced findings: **none**.
- Final status: **PASS — all REQUIRED gates pass; all advisory FLAGs cleared.**

## Chain-of-Verification Check

1. **Initial assessment:** all four REQUIRED gates evaluated against spec, tasks file, and standards sources.
2. **Self-question:** "Do all REQUIRED gates pass with explicit evidence?" → Yes; the FR↔Task map enumerates every spec FR and its testing path.
3. **Fact-checking:** spot-checked 6 FRs (window TZ computation, partial-failure envelope, 60 s polling, visibility gating, duplicate prevention, Event silent-expire) — every one maps to listed tasks and named test artifacts.
4. **Inconsistency resolution:** none required.
5. **Final synthesis:** **Status = PASS.** Two FLAGs above are advisory.
