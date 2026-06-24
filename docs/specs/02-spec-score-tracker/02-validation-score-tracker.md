# 02-validation-score-tracker.md

## 1. Executive Summary

- **Overall:** **PASS** (no gate tripped)
  - GATE A (CRITICAL/HIGH): PASS — 0 CRITICAL, 0 HIGH issues.
  - GATE B (Coverage Matrix `Unknown` count): PASS — every FR is **Verified**, zero `Unknown`.
  - GATE C (Proof artifacts accessible): PASS — every referenced proof file exists; production URL was confirmed by user; production mobile screenshot is on disk and embedded inline.
  - GATE D (tiered file integrity): PASS — every changed core file maps to a parent task in the task list; supporting files (tests, proofs, fixtures, generated migration) have explicit task linkage.
  - GATE E (repository standards): PASS — TS strict, Next.js 16 App Router, Tailwind v4 mobile-first, Drizzle, Auth.js v5 DB sessions, ESLint/Prettier/Conventional Commits all green.
  - GATE F (secrets in proofs): PASS — grep for common secret patterns across `docs/specs/02-spec-score-tracker/02-proofs/` returned zero matches; the only sanitized identifier (`<your-user-id>`) is a placeholder.
- **Implementation Ready:** **Yes** — Spec 02 (Score Tracker) is fully implemented behind passing automated tests and quality gates, deployed to production, and proven end-to-end via the production mobile screenshot + per-type prod DB favorites count.
- **Key metrics:**
  - Functional Requirements Verified: **22 / 22 (100%)** — 9 in Unit 1, 13 in Unit 2.
  - Proof Artifacts Working: **6 / 6 task-level proof files exist** + 1 production mobile screenshot embedded.
  - Files Changed vs Expected: every file the task list called out as in-scope was changed or explicitly justified as unchanged-by-design; **zero unmapped out-of-scope core changes**.

## 2. Coverage Matrix

### 2.1 Functional Requirements

#### Unit 1 — Favoriting

| FR | Status | Evidence |
| --- | --- | --- |
| FR1.1 Mobile-first search/browse across 4 sports × 4 favorite types | Verified | [components/favorites-search.tsx](components/favorites-search.tsx) + [app/api/favorites/search/route.ts](app/api/favorites/search/route.ts) (commit `6de8134`). Tests: [favorites-search.test.tsx](components/favorites-search.test.tsx) (3 tests passing). Type-labeled rows asserted. |
| FR1.2 One-tap add + one-tap remove | Verified | [favorite-add-button.tsx](components/favorite-add-button.tsx) + [favorite-remove-button.tsx](components/favorite-remove-button.tsx) (commit `6de8134`). Tests: [favorite-add-button.test.tsx](components/favorite-add-button.test.tsx) (5 tests, incl. 44 px touch-target assertion). |
| FR1.3 Persist scoped to signed-in user via authenticated Route Handlers | Verified | [app/api/favorites/route.ts](app/api/favorites/route.ts) (auth-gated POST/GET) + [lib/favorites/queries.ts](lib/favorites/queries.ts) (`WHERE userId = ...`). Tests: [route.test.ts](app/api/favorites/route.test.ts) covers 401 / scoped 201 / scoped list. Cross-user IDOR test in [[id]/route.test.ts](app/api/favorites/[id]/route.test.ts). |
| FR1.4 Reflect current state without full page reload | Verified | Optimistic Add (`useState` "added") in [favorite-add-button.tsx](components/favorite-add-button.tsx) and `router.refresh()` in [favorite-remove-button.tsx](components/favorite-remove-button.tsx). Asserted in [favorites-search.test.tsx](components/favorites-search.test.tsx) (initialFavorites pre-marks rows). |
| FR1.5 Team / Sport / League / Event semantics (incl. Event silent-expire) | Verified | [lib/favorite-matcher.ts](lib/favorite-matcher.ts) + [lib/sport-allowlist.ts](lib/sport-allowlist.ts) (commit `8bc2df7`). Tests: [favorite-matcher.test.ts](lib/favorite-matcher.test.ts) per-type happy path + Event silent-expire + Sport-favorite EFL Championship rejection (audit-F2 closure). |
| FR1.6 "My Favorites" screen with remove | Verified | [app/(app)/my-favorites/page.tsx](app/(app)/my-favorites/page.tsx) (commit `6de8134`). Tests: [page.test.tsx](app/(app)/my-favorites/page.test.tsx) (4 tests incl. all-types rendering + scoping). |
| FR1.7 Multiple favorites of same/different types | Verified | Schema allows: [favorites.ts](db/schema/favorites.ts) — uniqueIndex is on `(userId, type, externalId)` triple, not on `(userId, type)`. Prod DB query in task 6.9 shows `event: 2` rows for the user. |
| FR1.8 Empty-favorites state | Verified | `NoFavoritesPrompt` in [home-client.tsx](components/home-client.tsx); my-favorites empty state in [my-favorites/page.tsx](app/(app)/my-favorites/page.tsx). Test: [home-client.test.tsx](components/home-client.test.tsx) "shows the no-favorites prompt when user has no favorites". |
| FR1.9 Prevent duplicates via DB unique constraint | Verified | [db/schema/favorites.ts](db/schema/favorites.ts) `uniqueIndex(userId, type, externalId)` materialized in [0002_freezing_norrin_radd.sql](db/migrations/0002_freezing_norrin_radd.sql). API duplicate-handling test in [route.test.ts](app/api/favorites/route.test.ts). |

#### Unit 2 — Homepage Score Tracker

| FR | Status | Evidence |
| --- | --- | --- |
| FR2.1 Compute [yesterday, today, tomorrow] in browser timezone | Verified | [lib/date-window.ts](lib/date-window.ts) (`computeDateWindow`, `getBrowserTimezone`). Called from [home-client.tsx](components/home-client.tsx) on mount. Tests: [date-window.test.ts](lib/date-window.test.ts) (6 timezone-boundary cases incl. America/New_York, Pacific/Kiritimati, DST, leap-year). |
| FR2.2 Query TheSportsDB via server-side Route Handlers | Verified | [app/api/home/route.ts](app/api/home/route.ts) + [lib/home/aggregator.ts](lib/home/aggregator.ts) + [lib/sportsdb/client.ts](lib/sportsdb/client.ts) (`// SERVER-ONLY` doc comment at top). [Client never calls TheSportsDB directly — CORS-safe by design.](docs/specs/02-spec-score-tracker/02-tasks-score-tracker.md) |
| FR2.3 Group by day under Yesterday / Today / Tomorrow headings | Verified | [day-section.tsx](components/day-section.tsx) (sticky header) + ordered render in [home-client.tsx](components/home-client.tsx). Test: [home-client.test.tsx](components/home-client.test.tsx) asserts all three `day-section-{yesterday,today,tomorrow}` test ids. |
| FR2.4 Card shows participants + competition + round + venue + kickoff | Verified | [match-card.tsx](components/match-card.tsx) renders all five. Test: [match-card.test.tsx](components/match-card.test.tsx). Long-name truncation asserted via `title`. |
| FR2.5 Completed cards w/ final score + Final indicator | Verified | `final` branch in [match-card.tsx](components/match-card.tsx) (test id `final-label`). Test: "renders the Final branch with both scores". |
| FR2.6 In-progress cards w/ live score + period/minute/set + distinct Live indicator | Verified | `live` branch in [match-card.tsx](components/match-card.tsx) (`live-pill` + `live-progress`). Test: "renders the Live branch with score + progress". |
| FR2.7 Upcoming cards w/ kickoff + broadcast | Verified | `upcoming` branch in [match-card.tsx](components/match-card.tsx) (`upcoming-time` + `broadcast`). Test: "renders the Upcoming branch with kickoff time and broadcast". |
| FR2.8 Auto-refresh every 60s while ≥1 live | Verified | Polling effect gated on `envelopeHasLive(state.envelope)` in [home-client.tsx](components/home-client.tsx). Test: [home-client.test.tsx](components/home-client.test.tsx) "polls /api/home every 60s while ≥1 live match is on screen" (3 fetches across 2× 60 s with `vi.useFakeTimers()`). |
| FR2.9 Stop auto-refresh when no live | Verified | Polling effect's `[state]` dep + cleanup `clearInterval` handles transition. Test: "does not poll when no live matches are present" (180 s advance → still 1 fetch). |
| FR2.10 Pause on hidden, resume on visible (Page Visibility API) | Verified | `visibilitychange` listener in mount effect of [home-client.tsx](components/home-client.tsx) + tick-time visibility check. Test: "pauses polling when the tab becomes hidden and resumes on visible". |
| FR2.11 Dedup matches matched by multiple favorites | Verified | `matchFavoritesAgainstMatches` deduplicates by `match.id` in [favorite-matcher.ts](lib/favorite-matcher.ts). Test: [favorite-matcher.test.ts](lib/favorite-matcher.test.ts) "a match claimed by Team + League + Sport favorites appears exactly once". Aggregator test [aggregator.test.ts](lib/home/aggregator.test.ts) also covers Team+League dedup. |
| FR2.12 Data-source failure: non-blocking banner + partial data still renders | Verified | `source.ok === false` branch in [home-client.tsx](components/home-client.tsx) renders [data-source-error-banner.tsx](components/data-source-error-banner.tsx) ABOVE day sections. Test: "renders the data-source error banner when source.ok is false". |
| FR2.13 No-matches empty state | Verified | [no-matches-empty-state.tsx](components/no-matches-empty-state.tsx) rendered when `totalMatches === 0 && hasFavorites`. Test: "shows the no-matches empty state when user has favorites but no matches". Production screenshot ([02-task-06-prod-mobile.png](docs/specs/02-spec-score-tracker/02-proofs/02-task-06-prod-mobile.png)) captures this exact branch live. |
| FR2.14 Render correctly at 375 px with no horizontal scroll; multi-col at wider | Verified | [day-section.tsx](components/day-section.tsx) uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` per AGENTS.md mobile-first rules. Production mobile screenshot confirms 375 px layout. |

### 2.2 Repository Standards

| Standard Area | Status | Evidence |
| --- | --- | --- |
| TypeScript `strict`, no `any`, no untracked `@ts-ignore` | Verified | `pnpm typecheck` (`tsc --noEmit`) clean. Grep across new files in commits `f6e0d41` + `be3ef50` shows zero `any`/`@ts-ignore`. |
| Next.js 16 App Router (server components by default; client only when needed) | Verified | Home page is a server component; `"use client"` only on [home-client.tsx](components/home-client.tsx). Layout + my-favorites + favorites pages are server components. |
| Tailwind v4 mobile-first; ≥44 px touch targets; `min-h-dvh` for full-height | Verified | `min-h-11 min-w-11` on every interactive (bottom nav, add/remove, manage-favorites CTA). Day grid uses mobile-first `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Layout uses safe-area-inset paddings. |
| Drizzle ORM (schemas in `db/schema/`, generated migrations in `db/migrations/`) | Verified | [favorites.ts](db/schema/favorites.ts) + [0002_freezing_norrin_radd.sql](db/migrations/0002_freezing_norrin_radd.sql) (generated, committed, applied per task 2.13). |
| Auth.js v5 with Drizzle adapter and database sessions | Verified | Inherited from spec-01; all routes use `await auth()` from `@/auth`. |
| ESLint + Prettier + Vitest + RTL; tests colocated | Verified | `pnpm lint`, `pnpm format:check`, `pnpm test:ci` all clean. Each `foo.tsx` has neighbor `foo.test.tsx`. |
| Conventional Commits with task references in commit body | Verified | All four spec-02 commits use `feat(...)` or `docs(...)`; each body cites `Related to T... in Spec 02-spec-score-tracker`. |
| Server-only TheSportsDB calls (CORS-safe by design) | Verified | [lib/sportsdb/client.ts](lib/sportsdb/client.ts) carries a `// SERVER-ONLY` doc comment; no client component imports it. |
| Polling design per spec (60 s `setInterval`, live-gated, visibility-gated, `AbortController` cleanup) | Verified | [home-client.tsx](components/home-client.tsx) implements all four points; tests pin each. |

### 2.3 Proof Artifacts

| Unit/Task | Proof Artifact | Status | Verification Result |
| --- | --- | --- | --- |
| 1.0 | [02-task-01-proofs.md](docs/specs/02-spec-score-tracker/02-proofs/02-task-01-proofs.md) — TheSportsDB client + allowlist + matcher + date window | Verified | File present; 4 colocated test files cited; `pnpm test:ci` shows all 4 green (`client.test.ts`, `sport-allowlist.test.ts`, `favorite-matcher.test.ts`, `date-window.test.ts`). |
| 2.0 | [02-task-02-proofs.md](docs/specs/02-spec-score-tracker/02-proofs/02-task-02-proofs.md) — favorites schema + CRUD API | Verified | File present; migration `0002_freezing_norrin_radd.sql` exists; API tests cover 401/scoped 201/duplicate 200/cross-user 404/429 rate-limit. |
| 3.0 | [02-task-03-proofs.md](docs/specs/02-spec-score-tracker/02-proofs/02-task-03-proofs.md) — Favorites UI + bottom nav + (app) route group | Verified | File present; bottom-nav, favorites-search, favorite-add-button, my-favorites, favorites page tests all green. |
| 4.0 | [02-task-04-proofs.md](docs/specs/02-spec-score-tracker/02-proofs/02-task-04-proofs.md) — /api/home aggregator + cache + route handler | Verified | File present; route handler + aggregator tests (13 tests across both) green. |
| 5.0 | [02-task-05-proofs.md](docs/specs/02-spec-score-tracker/02-proofs/02-task-05-proofs.md) — homepage UI (day groups, match cards, empty/error) | Verified | File present; 4 new component files + 3 test files cited; gates clean. |
| 6.0 | [02-task-06-proofs.md](docs/specs/02-spec-score-tracker/02-proofs/02-task-06-proofs.md) + [02-task-06-prod-mobile.png](docs/specs/02-spec-score-tracker/02-proofs/02-task-06-prod-mobile.png) | Verified | Proof markdown present; production mobile screenshot saved + inline-embedded; 4 polling tests pin the four required behaviors with `vi.useFakeTimers()`; prod Neon per-type query result captured (all 4 types present). |

## 3. Validation Issues

Three **MEDIUM** issues — none blocking. They are about the **density of visual screenshot evidence**, not about feature correctness or test coverage.

| Severity | Issue | Impact | Recommendation |
| --- | --- | --- | --- |
| MEDIUM | Some spec-level proof-artifact screenshots aren't on disk. The spec section "Unit 2 → Proof Artifacts" lists a 1280 px desktop screenshot, a Live-state card screenshot, and an Upcoming card screenshot with kickoff/competition/round/venue/broadcast visible. Only the 375 px production mobile screenshot ([02-task-06-prod-mobile.png](docs/specs/02-spec-score-tracker/02-proofs/02-task-06-prod-mobile.png)) is on disk; the three card branches are covered by `components/match-card.test.tsx` unit tests instead. | Functional correctness is fully covered by tests; the gap is purely *visual* evidence for human review. | If the user wants those screenshots for the validation appendix, capture them by signing in to production while a real live + upcoming match is in window (or temporarily inject a fixture) and drop the files into `docs/specs/02-spec-score-tracker/02-proofs/`. Otherwise, the MatchCard unit tests + production mobile screenshot are sufficient to confirm behavior. |
| MEDIUM | Unit-1 visual proof screenshots not on disk either. Spec asks for: favorites search at 375 px, My Favorites with one of each type at 375 px, zero-favorites empty state. None of these are present as files; persistence is instead proven by the production prod-DB query in Task 6.9 (which shows ≥1 row of each of the four `type` values). | Same as above — feature correctness covered, visual evidence partial. | Optional. The prod DB query is a stronger correctness proof than a screenshot; capture screenshots only if they're needed for non-engineering stakeholders. |
| MEDIUM | The cross-device walkthrough (mobile → sign out → desktop → favorites still present) is asserted only verbally by the user in Task 6.5. | Traceability: the persistence claim is doubly-proven by API tests + prod DB query, so this is a documentation gap, not a behavior gap. | Optional. If desired, augment the Task 6 proof file with a short note from the user describing the device-A → device-B walkthrough. |

No CRITICAL, HIGH, or LOW issues identified.

## 4. Evidence Appendix

### 4.1 Git commits analyzed

| Commit | Subject | Files changed | Spec linkage |
| --- | --- | --- | --- |
| `8bc2df7` | feat(lib): TheSportsDB client, sport allowlist, favorite matcher, date window | `lib/sportsdb/{client,types,__fixtures__}/*`, `lib/sport-allowlist.{ts,test.ts}`, `lib/favorite-matcher.{ts,test.ts}`, `lib/date-window.{ts,test.ts}`, audit + proof + task md | Task 1.0 |
| `b50c9c7` | feat(api): favorites schema + CRUD API with auth + Zod + rate limit | `db/schema/{favorites,index}.ts`, `db/migrations/0002_*`, `lib/{rate-limit,favorites/{validators,queries}}.{ts,test.ts}`, `app/api/favorites/route.{ts,test.ts}`, `app/api/favorites/[id]/route.{ts,test.ts}`, proof + task md | Task 2.0 |
| `6de8134` | feat(app): favorites UI + bottom nav + (app) route group | `app/(app)/{layout,home,favorites,my-favorites}/*`, `app/api/favorites/search/route.ts`, `components/{bottom-nav,favorites-search,favorite-add-button,favorite-remove-button}.{ts,test.tsx}`, `lib/events-catalog.ts`, proof + task md | Task 3.0 |
| `f61796d` | feat(api): /api/home aggregator + cache + route handler | `app/api/home/route.{ts,test.ts}`, `lib/home/{aggregator,cache}.{ts,test.ts}`, `db/schema/favorites.ts` (`.$type<Sport>()` narrowing), proof + task md | Task 4.0 |
| `f6e0d41` | feat(app): score-tracker homepage UI — day groups, match cards, empty/error states | `app/(app)/home/page.{tsx,test.tsx}`, `components/{home-client,day-section,match-card,no-matches-empty-state,data-source-error-banner}.{tsx,test.tsx}`, proof + task md | Task 5.0 |
| `be3ef50` | feat(app): live-gated polling + visibility pause/resume for /home | `components/home-client.{tsx,test.tsx}`, proof + task md | Task 6.1–6.4 |
| `98c14ba` | docs(spec-02): close out Task 6.0 — manual e2e, deploy, mobile screenshot, prod DB count | `docs/specs/02-spec-score-tracker/02-proofs/02-task-06-{proofs.md,prod-mobile.png}`, `docs/specs/02-spec-score-tracker/02-tasks-score-tracker.md` | Task 6.5–6.10 |

Every commit names the spec in its body via the `Related to T... in Spec 02-spec-score-tracker` trailer.

### 4.2 Quality-gate outputs (re-run during this validation)

```bash
$ pnpm typecheck       # tsc --noEmit — clean
$ pnpm lint            # eslint — clean
$ pnpm format:check    # "All matched files use Prettier code style!"
$ pnpm test:ci         # Test Files 24 passed (24) | Tests 162 passed (162)
```

### 4.3 Proof-file inventory

```text
docs/specs/02-spec-score-tracker/02-proofs/
├── 02-task-01-proofs.md
├── 02-task-02-proofs.md
├── 02-task-03-proofs.md
├── 02-task-04-proofs.md
├── 02-task-05-proofs.md
├── 02-task-06-prod-mobile.png
└── 02-task-06-proofs.md
```

### 4.4 Security scan (GATE F)

```bash
$ grep -rE "(sk-|sk_live|ghp_|AKIA|password\s*=\s*['\"][^'\"]{4,}|secret\s*=\s*['\"][^'\"]{8,})" \
  docs/specs/02-spec-score-tracker/02-proofs/
# (no matches)
```

No real credentials present. The sole sanitized identifier is `<your-user-id>` as a placeholder in the prod DB query example.

### 4.5 File-integrity classification (GATE D)

All files changed by the seven spec-02 commits fall into one of:

- **Core implementation files** (production code, schema, route handlers, client components) — each maps to a parent task in [02-tasks-score-tracker.md](docs/specs/02-spec-score-tracker/02-tasks-score-tracker.md) "Relevant Files" section.
- **Supporting verification files** (colocated `*.test.ts`/`*.test.tsx`, fixtures under `lib/sportsdb/__fixtures__/`, generated migration SQL + Drizzle journal, proof markdown, validation report, task file updates) — each is explicitly linked to its core sibling in the task list or in the commit body.

There are **zero unmapped out-of-scope core changes** (GATE D1 = PASS).

The only `auth/` touch (`2476fc5 fix(auth): allow account linking on the Google provider`) predates spec-02 close-out and is unrelated to the score-tracker scope; flagged here for transparency, but it's a separate fix the user explicitly requested during the build (not in-scope for spec 02 validation either way).

---

**Validation Completed:** 2026-06-24 11:55 (local)
**Validation Performed By:** Claude Opus 4.7
