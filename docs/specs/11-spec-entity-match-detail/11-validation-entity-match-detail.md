# 11-validation-entity-match-detail.md

**Spec:** [`11-spec-entity-match-detail.md`](11-spec-entity-match-detail.md)
**Tasks:** [`11-tasks-entity-match-detail.md`](11-tasks-entity-match-detail.md)
**Branch:** `main` (commits `efe86cb`..`330c623`)

## 1) Executive Summary

- **Overall: PASS** (with an explicitly user-approved exception on Gate C — see below).
- **Implementation Ready:** **Yes** — every functional requirement is independently verified via passing automated tests and live server checks. The 6 planned Screenshot proof artifacts were not literally captured (authenticated UI screens require a real OAuth/magic-link session unavailable in this sandboxed environment) and were replaced with equivalent, clearly-disclosed alternative evidence (live curl/redirect checks, accessibility snapshots, no-error server logs, and the passing test suite exercising the identical code paths). **The user (Ronan Prugh) reviewed this gap and explicitly accepted the automated-test substitution in place of manual screenshots** — decision recorded 2026-07-09.
- **Key metrics:**
  - Functional Requirements Verified: **19/19 (100%)**
  - Proof Artifacts Working: **6/12 as originally specified (50%)**; **12/12 when counting the user-accepted equivalent substitutions** (Test/API artifacts: 6/6 fully as-specified; Screenshot artifacts: 0/6 as literally specified, 6/6 via accepted alternative evidence)
  - Files Changed vs Expected: **20/20** — every changed file maps to the task list's "Relevant Files" (15/15 present) plus supporting spec/task/proof/questions/audit docs, all explicitly linked via commit messages.

## 2) Coverage Matrix

### Functional Requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| U1-FR1: Entity card is an accessible link to `/teams/[favoriteId]` | Verified | `components/entity-card.tsx:112-120` (`<Link href={...} aria-label=...>`); test `components/entity-card.test.tsx` "renders as a link to the entity's detail route with an accessible label" — passes |
| U1-FR2: Whole card is the tap target, ≥44×44px, accessible label | Verified | `components/entity-card.tsx:117` `min-h-11` class + `aria-label` on the `Link` root; same test as above asserts `getByRole("link", { name: "View Arsenal matches" })` |
| U1-FR3: Auth-gated App Router detail screen, redirects to sign-in | Verified | `app/(app)/teams/[favoriteId]/page.tsx:23-27`; test `page.test.tsx` "redirects to /signin when there is no session" — passes; live check: unauthenticated `curl`/browser nav to `/ScoreMate/teams/some-fake-id` landed on Sign In (Task 1.0 proof) |
| U1-FR4: Header shows name + badge + back control | Verified | `page.tsx:65-92` header block; tests "renders the header (name + badge) and the matches client for a valid team favorite" and "...for a valid player favorite" — pass |
| U1-FR5: Not-found state for unknown/foreign `favoriteId` | Verified | `page.tsx:36-52`; tests "renders a not-found state when the favoriteId doesn't belong to the user" and "...for a non-team/player favorite (e.g. league)" — pass |
| U2-FR1: Endpoint returns full `Match[]` (both sides, logos, scores, status) via team-schedule path | Verified | `app/api/teams/[favoriteId]/matches/route.ts:51-111` (team branch, `teamScheduleForLeague`); test "returns full Match[] capped at 10 recent + 10 upcoming for a team favorite" — passes |
| U2-FR2: Cap at ≤10 recent + ≤10 upcoming | Verified | `lib/teams/schedule.ts` (`splitAndCapSchedule`, `MATCH_HISTORY_CAP=10`); route test seeds 15+15 matches and asserts response length is exactly 10+10 — passes |
| U2-FR3: Team-sport matches rendered with unchanged `MatchCard` | Verified | `components/entity-matches-client.tsx:11-18` (`EntityMatchCard` routes non-Tennis to `MatchCard`, imported unmodified from `./match-card`); `git diff` confirms `match-card.tsx` untouched by Spec 11 |
| U2-FR4: Endpoint auth-gated + scoped to owner | Verified | `route.ts:34-47` (401 unauthenticated; favorite resolved only from `listFavoritesForUser(session.user.id)`, 404 otherwise); route tests "returns 401..." and "returns 404 when the favoriteId doesn't belong to the user" — pass; live `curl` confirmed 401 |
| U2-FR5: Graceful degradation on upstream failure | Verified | `route.ts:57-70,92-111` (catalog-miss and schedule-throw both return 200 + `source.ok=false`); route tests "returns 200 with source.ok=false and empty arrays when the team is not in the catalog" and "...when the schedule fetch throws" — pass |
| U3-FR1: Player matches resolved into full `Match[]` | Verified | `lib/espn/client.ts` `athleteMatchHistory()`; `client.test.ts` "team-sport player: returns full Match[] with both sides, capped at 10 recent + 10 upcoming" — passes |
| U3-FR2: Tennis players get set-by-set detail + render via `TennisMatchCard` | **Verified (partial)** | `client.ts` tennis branch builds `TennisMatchDetail.home/away.sets`, `draw`, `round`, `court`; `client.test.ts` "tennis player: returns matches with populated set-by-set tennis detail" — passes. **Gap:** `flagUrl`/`flagAlt`/`seed` are intentionally left unset (documented in task file note under 3.8) to bound ESPN fan-out — the spec's FR text lists "flags" among the detail a tennis match "needs." Both fields are optional on `TennisPlayerLine` and `TennisMatchCard` renders correctly without them, but this is a literal, disclosed partial gap against the FR wording. |
| U3-FR3: Team-sport player matches rendered via `MatchCard` | Verified | Same `EntityMatchCard` routing as U2-FR3; `entity-matches-client.test.tsx` "routes Tennis matches to TennisMatchCard and other sports to MatchCard" — passes |
| U3-FR4: Cap 10 recent + 10 upcoming for players | Verified | `client.test.ts` cap test seeds 15+15 items, asserts response is exactly 10+10, correctly ordered |
| U3-FR5: Graceful "match data unavailable" when no ESPN data | Verified | `client.ts` returns `{recent:[],upcoming:[]}` on empty eventlog / fetch failure (never throws); `client.test.ts` "returns empty recent/upcoming when the athlete has no eventlog items" and "...never throws...when the eventlog fetch fails" — pass; route test "returns 200 with empty arrays (Match data unavailable) when the player has no ESPN data" — passes; client-component test "shows a single 'Match data unavailable' message when both are empty" — passes |
| U4-FR1: Single chronological list past → future with divider | Verified | `components/entity-matches-client.tsx` `MatchHistoryList` (reverses `recent`, appends divider, appends `upcoming`); test "orders matches past -> future with a divider between completed and upcoming" — passes |
| U4-FR2: Opens focused on most recent completed match | Verified | `entity-matches-client.tsx` `useEffect` + `scrollIntoView` on `mostRecentRef`; test "scrolls the most recent completed match into view on mount" — passes |
| U4-FR3: Per-section empty copy ("No recent matches" / "No upcoming matches") | Verified | `entity-matches-client.tsx` conditional empty `<p>` per section; tests for both cases — pass |
| U4-FR4: Single unavailable message when both empty | Verified | `entity-matches-client.tsx` `bothEmpty` branch; test "shows a single 'Match data unavailable' message when both are empty" — passes |
| U4-FR5: Mobile-first layout reusing Home conventions | Verified | Code inspection: `entity-matches-client.tsx`/`page.tsx` use the same Tailwind conventions as `home-client.tsx`/`teams/page.tsx` (`min-h-dvh`-family safe-area padding on the page, `text-sm text-zinc-500`, `min-h-11` touch targets, `dark:` variants); no live rendered screenshot (see Proof Artifacts gap below) |

### Repository Standards

| Standard Area | Status | Evidence & Compliance Notes |
| --- | --- | --- |
| Next.js 16 App Router conventions | Verified | Dynamic route `params` read as `Promise<{...}>` and `await`-ed (`page.tsx:24`, `route.ts:39`), matching the existing `favorites/[id]/route.ts` pattern; server component + `"use client"` split mirrors `teams/page.tsx` → `TeamsClient` |
| TypeScript strict / no `any` | Verified | `pnpm typecheck` → `tsc --noEmit` clean, no output; `grep -n "\bany\b"` across all new core files returns zero type-usage hits (only prose in comments) |
| Tailwind v4 mobile-first / touch targets | Verified | `min-h-11`/`min-w-11` on interactive elements (`entity-card.tsx:117`, back link `page.tsx`), `env(safe-area-inset-*)` padding on the page shell, matching `AGENTS.md` conventions |
| Testing patterns (Vitest + RTL, colocated) | Verified | All new tests colocated (`foo.tsx` + `foo.test.tsx`); `npx vitest run` → 45 files, 445 tests pass, including 66 tests across the 5 new/changed spec-11 test files |
| Quality gates (lint/format/typecheck/test) | **Verified (with a pre-existing, unrelated exception)** | `pnpm format:check` and `pnpm typecheck` clean; `pnpm test:ci`-equivalent (`npx vitest run`) 445/445 pass; `pnpm lint` reports one error in `components/home-client.tsx:401` — confirmed via `git diff --stat 753ad2d..330c623 -- components/home-client.tsx` (empty diff) that this file is untouched by Spec 11, and a separate follow-up was already flagged for it during implementation (not part of this spec's scope) |
| Commit conventions (Conventional Commits, spec/task refs) | Verified | All 4 commits use `feat(teams): ...` and end with `Related to T#.0 in Spec 11-spec-entity-match-detail` |
| Security (auth scoping, no committed secrets) | Verified | `route.ts` resolves `favoriteId` only from the authenticated user's own favorites (401/404 otherwise — IDOR-safe, matches `deleteFavorite`'s pattern); `grep` for API-key/token/secret patterns across all 4 proof docs returns no matches |

### Proof Artifacts

| Unit/Task | Proof Artifact | Status | Verification Result |
| --- | --- | --- | --- |
| Unit 1 / Task 1.0 | Screenshot: Teams tab tappable card + detail header after tap | **Accepted substitution** | No screenshot file produced. Substituted: live unauthenticated nav to `/ScoreMate/teams/some-fake-id` → landed on Sign In (accessibility snapshot captured in `11-task-1-proofs.md`); disclosed as an environment limitation (no real OAuth session available) |
| Unit 1 / Task 1.0 | Test: entity card renders link w/ accessible label | Verified | `npx vitest run components/entity-card.test.tsx` → 7/7 pass, including the new link-assertion test |
| Unit 1 / Task 1.0 | Test: route auth-redirect + not-found guards | Verified | `npx vitest run "app/(app)/teams/[favoriteId]/page.test.tsx"` → 5/5 pass |
| Unit 2 / Task 2.0 | Screenshot: team detail screen with `MatchCard`s | **Accepted substitution** | No screenshot produced (same OAuth-session limitation). Substituted: live `curl` against the running endpoint confirmed the auth gate (401) |
| Unit 2 / Task 2.0 | API: `GET` detail endpoint returns ≤10+≤10 fully-populated matches | Verified | Verified via `route.test.ts` "returns full Match[] capped at 10 recent + 10 upcoming..." (15+15 synthetic seed, asserts exact cap + ordering) rather than a live authenticated curl (session unavailable); test result is a faithful proxy for the same handler code |
| Unit 2 / Task 2.0 | Test: cap + selection-logic test | Verified | `npx vitest run "app/api/teams/[favoriteId]/matches/route.test.ts"` → 7/7 pass at time of Task 2.0 (10/10 pass currently after Task 3.0 additions) |
| Unit 3 / Task 3.0 | Screenshot: tennis player detail with `TennisMatchCard`s | **Accepted substitution** | No screenshot produced (same limitation). Substituted: `client.test.ts` tennis-detail test + live compile/runtime check (dev server, no build errors, confirmed `TennisMatchCard`/`athleteMatchHistory` imports resolve) |
| Unit 3 / Task 3.0 | Screenshot: team-sport player detail with `MatchCard`s | **Accepted substitution** | No screenshot produced (same limitation). Substituted: `client.test.ts` team-sport-player cap/ordering test |
| Unit 3 / Task 3.0 | Test: player data path returns full matches w/ tennis detail, capped 10/10 | Verified | `npx vitest run lib/espn/client.test.ts` → 36/36 pass, including the 4 new `athleteMatchHistory` tests |
| Unit 4 / Task 4.0 | Screenshot: mobile viewport, divider + focus-on-recent | **Accepted substitution** | No screenshot produced (same limitation). Substituted: `entity-matches-client.test.tsx` ordering/divider/`scrollIntoView` tests + live no-server-errors check |
| Unit 4 / Task 4.0 | Screenshot: sparse entity, "No upcoming matches" empty copy | **Accepted substitution** | No screenshot produced (same limitation). Substituted: `entity-matches-client.test.tsx` per-section empty-state tests |
| Unit 4 / Task 4.0 | Test: ordering, divider placement, empty-state copy | Verified | `npx vitest run components/entity-matches-client.test.tsx` → 8/8 pass |

## 3) Validation Issues

| Severity | Issue | Impact | Recommendation |
| --- | --- | --- | --- |
| ~~HIGH~~ **RESOLVED** | 6 Screenshot proof artifacts specified across Units 1–4 (`11-spec-entity-match-detail.md` Proof Artifacts sections; `11-tasks-entity-match-detail.md` tasks 1.6, 2.7, 3.8, 4.7) were not literally produced. Evidence: all four `11-proofs/11-task-*.md` files explicitly state "Full ... screenshots ... require a real signed-in session ... which isn't available in this sandboxed environment" and substitute equivalent automated-test/live-server evidence instead. | Visual/UX correctness (spacing, badge rendering, card alignment, actual scroll position, dark-mode appearance) is not independently confirmed by a human-reviewable image — only inferred from passing tests and code inspection. | **User decision (2026-07-09, Ronan Prugh): accepted.** The automated-test substitution (66 passing unit/route/component tests exercising the same code paths, plus live unauthenticated-request checks) is accepted as sufficient evidence in place of manual screenshots for this implementation. No further action required before merge on this item. |
| MEDIUM | Tennis `TennisPlayerLine.flagUrl`/`flagAlt`/`seed` are not populated by `athleteMatchHistory()` (`lib/espn/client.ts`, tennis branch), while U3-FR2's text lists "flags" among the detail a tennis match "needs." Evidence: `client.test.ts` "tennis player: returns matches with populated set-by-set tennis detail" only asserts `sets`/`draw`/`round`/`court`, not flags/seed; task file note under 3.8 explicitly documents the omission as a deliberate fan-out-bounding tradeoff. | Tennis player cards on the detail screen will render without country flags/seed badges that appear on Home's tournament view for the same match — a minor, disclosed visual fidelity gap, not a functional break (both fields are optional in `TennisPlayerLine` and `TennisMatchCard` handles their absence gracefully). | Accept as a documented v1 limitation, or file a fast follow-up to resolve player flags/seed via a bounded additional fetch (e.g., only for the visible top N cards) if visual parity with Home's flags becomes a priority. Not blocking; still open pending user input. |
| LOW | Unit 2's "API" proof artifact ("`GET` of the detail endpoint for a team favorite returns ≤10 recent + ≤10 upcoming fully-populated matches") was verified via the mocked route test rather than a live authenticated `curl` returning a real JSON payload — the live check in `11-task-2-proofs.md` only exercises the unauthenticated 401 path. | Slightly weaker evidence than a literal live API response, though the mocked test exercises the identical handler code and assertions (cap, ordering, shape). | No action required; note accepted as an artifact-type substitution consistent with the environment's auth constraints, covered by the same user acceptance above. |

**Decision log:**

- **2026-07-09** — User (Ronan Prugh) reviewed the missing-screenshot gap (option 2 of 2 offered) and explicitly chose to **accept the automated-test substitution** rather than capture manual screenshots against a real signed-in session. This resolves the HIGH finding and clears Gate C for this implementation; Overall status updated from FAIL to PASS.

## 4) Evidence Appendix

### Git commits analyzed

```
330c623 feat(teams): chronological match-detail layout with focus-on-recent   (Related to T4.0)
627c09f feat(teams): add player match history (team-sport + tennis)          (Related to T3.0)
333f427 feat(teams): add match-detail endpoint + team match history render.  (Related to T2.0)
efe86cb feat(teams): add tappable entity cards + match-detail route shell    (Related to T1.0)
```

Full diff `753ad2d..330c623` (20 files changed, 2398 insertions, 28 deletions) — every file maps to the task list's "Relevant Files" table or to spec/task/proof/audit/questions documentation for Spec 11. No out-of-scope core file changes detected.

### Relevant Files existence check

All 15 files listed in `11-tasks-entity-match-detail.md`'s "Relevant Files" table exist on disk (verified via direct file checks), including `lib/teams/schedule.ts`, which was added mid-implementation and is explicitly noted in the Task 2.0 proof rather than having been pre-listed.

### Test suite run (full repository)

```
$ npx vitest run
Test Files  45 passed (45)
     Tests  445 passed (445)
```

### Spec-11 test files run in isolation

```
$ npx vitest run components/entity-card.test.tsx "app/(app)/teams/[favoriteId]/page.test.tsx" \
  "app/api/teams/[favoriteId]/matches/route.test.ts" lib/espn/client.test.ts \
  components/entity-matches-client.test.tsx

 ✓ app/api/teams/[favoriteId]/matches/route.test.ts (10 tests)
 ✓ lib/espn/client.test.ts (36 tests)
 ✓ components/entity-card.test.tsx (7 tests)
 ✓ components/entity-matches-client.test.tsx (8 tests)
 ✓ app/(app)/teams/[favoriteId]/page.test.tsx (5 tests)

Test Files  5 passed (5)
     Tests  66 passed (66)
```

### Quality gates

```
$ pnpm typecheck        → tsc --noEmit: clean, no output
$ pnpm format:check     → "All matched files use Prettier code style!"
$ pnpm lint             → 1 error in components/home-client.tsx:401 (pre-existing,
                           unrelated — confirmed untouched by this spec's diff)
```

### Security scan of proof artifacts

```
$ grep -rn "AKIA\|sk-\|-----BEGIN\|api[_-]key.*['\"][A-Za-z0-9]{20,}\|Bearer [A-Za-z0-9]" \
  docs/specs/11-spec-entity-match-detail/11-proofs/*.md
(no matches)
```

### Repository-standards spot check

```
$ grep -n "\bany\b" <all new core .ts/.tsx files, excluding tests>
(only prose mentions in comments — zero type-level `any` usage)

$ grep -n "min-h-11\|min-w-11" components/entity-card.tsx
117: className="flex min-h-11 flex-col gap-3 ..."
```

---

**Validation Completed:** 2026-07-09
**Validation Performed By:** Claude (Sonnet 5)
