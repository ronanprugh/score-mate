# 12-tasks-performance-optimization.md

Task list for `12-spec-performance-optimization.md`.

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `lib/perf/server-timing.ts` | New timing helper: wraps a route handler body, records duration + counters, emits a structured log line and builds the `Server-Timing` header value. |
| `lib/perf/server-timing.test.ts` | Unit tests for the timing helper (duration capture, header format, no body mutation). |
| `app/api/home/route.ts` | Instrument with timing + fan-out count; primary optimization target endpoint. |
| `app/api/home/route.test.ts` | Extend to assert `Server-Timing` header present and response body unchanged. |
| `app/api/teams/route.ts` | Instrument with timing. |
| `app/api/teams/route.test.ts` | Extend for the timing header. |
| `app/api/teams/[favoriteId]/matches/route.ts` | Instrument with timing. |
| `app/api/teams/[favoriteId]/matches/route.test.ts` | Extend for the timing header. |
| `app/api/favorites/search/route.ts` | Instrument with timing. |
| `app/api/favorites/search/route.test.ts` | Extend for the timing header. |
| `lib/home/aggregator.ts` | Exposes the planned fan-out size (league keys × dates + tennis calls) for instrumentation; hosts candidate fan-out-reduction optimization. |
| `lib/home/aggregator.test.ts` | Extend for any aggregator changes (fan-out exposure, reduction logic). |
| `lib/home/cache.ts` | Hosts candidate optimizations: tennis cache timezone-key fragmentation, in-flight request coalescing. |
| `lib/home/cache.test.ts` | Extend for cache-key and coalescing changes. |
| `lib/home/tennis-aggregator.ts` | Involved if the tennis fan-out or TZ-bucketing boundary moves during Task 3.0. |
| `lib/home/tennis-aggregator.test.ts` | Extend if tennis aggregation changes. |
| `components/home-client.tsx` | Candidate polling-cost optimization (only if baseline shows it matters and user approves per Spec § Open Questions 2). |
| `components/home-client.test.tsx` | Extend if polling behavior changes. |
| `docs/specs/12-spec-performance-optimization/12-baseline-performance.md` | New deliverable: baseline timings, confirmed targets, selection rationale, before/after table. |
| `docs/specs/12-spec-performance-optimization/12-code-quality-findings.md` | New deliverable: prioritized code-quality findings + Cache Components migration evaluation. |

### Notes

- Colocate tests next to sources (repo convention). Run a single file with `pnpm vitest run <path>`; full gates are `pnpm test:ci`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- Consult `node_modules/next/dist/docs/` before touching route handlers or caching (AGENTS.md requirement).
- Baseline/after measurements must run against a production build (`pnpm build && pnpm start`) — never `next dev`.
- Commits: Conventional Commits referencing the task, e.g. `perf(home): coalesce tennis fetch across timezones` + `Related to T3.2 in Spec 12-spec-performance-optimization`.
- Timing logs and headers carry durations, route names, and counts only — no user ids, tokens, or upstream URLs (Spec § Security Considerations).

## Tasks

### [x] 1.0 Instrument data routes with server timing and fan-out counts

#### 1.0 Proof Artifact(s)

- Log: structured timing lines (route, duration ms, fan-out count for `/api/home`) from a `next start` session demonstrates per-request measurement works (FR 1.1, 1.2)
- CLI: `curl -sD - -o /dev/null http://localhost:3000/api/home?...` output showing the `Server-Timing` response header demonstrates timing is exposed without body changes (FR 1.3)
- Test: new colocated unit tests for the timing helper pass, and `pnpm test:ci` passes in full, demonstrates no behavior change (FR 1.4)
- Diff: instrumentation adds no upstream calls or sync I/O to the hot path demonstrates negligible overhead (FR 1.4)

#### 1.0 Tasks

- [x] 1.1 Read the bundled Next.js 16 docs on route handlers and response headers (`node_modules/next/dist/docs/01-app/`) to confirm the idiomatic way to attach headers to `NextResponse.json` in this version.
- [x] 1.2 Create `lib/perf/server-timing.ts`: a `withServerTiming(routeName, handler)` wrapper (or equivalent helper) that measures total handler duration with `performance.now()`, accepts optional named counters (e.g. `fanout`), emits one structured JSON log line (`{ route, durationMs, counters }`) via `console.log`, and appends a `Server-Timing` header to the returned response. No user identifiers, tokens, or upstream URLs in the output.
- [x] 1.3 Write `lib/perf/server-timing.test.ts`: asserts duration is captured, the `Server-Timing` header is well-formed, counters appear in the log line, the response body is passed through byte-identical, and errors from the wrapped handler propagate unchanged.
- [x] 1.4 Export the planned fan-out size from the aggregation path: extend `lib/home/aggregator.ts` so the number of upstream fetcher invocations (league keys × 5 dates + 3 tennis-day calls) is observable by the route handler without changing `HomeEnvelope` (e.g. an exported `planFanoutCount(favorites, dates)` helper or an optional out-parameter). Update `lib/home/aggregator.test.ts` to cover it.
- [x] 1.5 Instrument `app/api/home/route.ts` with the wrapper, including the fan-out counter; extend `app/api/home/route.test.ts` to assert the header exists and the JSON body shape is unchanged.
- [x] 1.6 Instrument `app/api/teams/route.ts`, `app/api/teams/[favoriteId]/matches/route.ts`, and `app/api/favorites/search/route.ts` (duration only); extend each colocated route test for the header.
- [x] 1.7 Run all quality gates (`pnpm test:ci`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`); capture a `curl -sD -` proof of the `Server-Timing` header against `pnpm build && pnpm start`.
- [x] 1.8 Commit as `perf: add server timing instrumentation to data routes` with body `Related to T1.0 in Spec 12-spec-performance-optimization`.

### [x] 2.0 Capture baseline performance report and confirm targets

#### 2.0 Proof Artifact(s)

- Document: `docs/specs/12-spec-performance-optimization/12-baseline-performance.md` with cold-cache and warm-cache timings for all four instrumented endpoints against a production build (`next build` + `next start`) demonstrates the baseline exists (FR 1.5)
- Document: baseline doc records the derived numeric targets and identifies the highest-cost bottleneck(s) demonstrates Unit 2 can be prioritized from evidence (Spec § Open Questions 1)
- Chat: user confirmation of the numeric targets before any optimization work begins demonstrates the Q4 measurement-first gate was honored

#### 2.0 Tasks

- [x] 2.1 Build and serve a production build locally (`pnpm build && pnpm start`) with a signed-in test session and at least one favorite per relevant sport so `/api/home` exercises a realistic fan-out.
- [x] 2.2 Measure cold-cache latency: restart the server (fresh cache), then hit each of the four endpoints once and record the timing log line (duration + fan-out count).
- [x] 2.3 Measure warm-cache latency: repeat each request ≥5 times within the shortest TTL window (30s) and record min/median/max durations.
- [x] 2.4 Write `12-baseline-performance.md`: a table of cold/warm numbers per endpoint, the observed `/api/home` fan-out count, a ranked list of the highest-cost bottlenecks mapped to the spec's candidate-optimization list, and proposed numeric targets derived from the numbers (e.g. "warm median under N ms, cold under M ms"). Redact any cookies/headers in captured output.
- [x] 2.5 Present the baseline and proposed targets to the user and STOP — do not begin Task 3.0 until the user confirms the targets (and, if polling ranks highest, until the user answers Spec § Open Questions 2).
- [x] 2.6 After confirmation, record the confirmed targets in the baseline doc and commit as `docs(perf): add baseline performance report` with body `Related to T2.0 in Spec 12-spec-performance-optimization`.

### [ ] 3.0 Implement highest-impact hot-path optimizations

#### 3.0 Proof Artifact(s)

- Document: note in `12-baseline-performance.md` naming which candidate optimization(s) were selected and why (baseline evidence) demonstrates prioritization followed measurement (FR 2.1)
- Test: new colocated unit tests for each changed module (e.g. `lib/home/cache.test.ts`, `lib/home/tennis-aggregator.test.ts`) pass demonstrates optimized code is covered (FR 2.3, 2.4)
- Test: `pnpm test:ci` passes in full demonstrates response shapes, bucketing semantics, and partial-failure behavior are preserved (FR 2.3, 2.4, 2.5)
- CLI: `pnpm typecheck` and `pnpm lint` exit clean demonstrates quality gates hold

#### 3.0 Tasks

- [ ] 3.1 Record in `12-baseline-performance.md` which candidate optimization(s) the baseline ranks highest and are therefore selected (from: tennis TZ-key fragmentation, fan-out reduction, in-flight coalescing, polling cost — or a newly discovered bottleneck, documented).
- [ ] 3.2 If selected — tennis TZ fragmentation: restructure `lib/home/cache.ts` so the expensive per-tournament upstream fetch is cached once per day (TZ-independent key) and timezone bucketing runs cheaply outside the cache boundary (likely moving the bucketing seam in `lib/home/tennis-aggregator.ts` / `lib/espn/tennis.ts`); bump `CACHE_KEY_PREFIX`; extend `lib/home/cache.test.ts` to prove two timezones share one upstream fetch while bucketing stays correct.
- [ ] 3.3 If selected — fan-out reduction: narrow the `/api/home` call plan in `lib/home/aggregator.ts` (skip calls that cannot contribute matches) without changing bucketing semantics; extend `lib/home/aggregator.test.ts` to pin the reduced plan and unchanged envelope.
- [ ] 3.4 If selected — in-flight coalescing: deduplicate concurrent identical upstream fetches in `lib/home/cache.ts` (e.g. a keyed in-flight promise map); add tests proving N concurrent callers trigger one fetch and errors still propagate per caller.
- [ ] 3.5 If selected — polling cost (only with explicit user approval per Spec § Open Questions 2): reduce client transfer/server work for unchanged data in `components/home-client.tsx`; add/extend colocated tests.
- [ ] 3.6 Verify behavior preservation: `pnpm test:ci` in full (response shapes, local-date bucketing, `source.errors` partial-failure semantics all pinned by existing tests), plus `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- [ ] 3.7 Commit each optimization separately as `perf(home): <what>` with body `Related to T3.0 in Spec 12-spec-performance-optimization`.

### [ ] 4.0 Measure after-state and record before/after evidence

#### 4.0 Proof Artifact(s)

- Document: before/after table appended to `12-baseline-performance.md` showing latency reduction on the targeted endpoint(s) against confirmed targets demonstrates measured improvement (FR 2.2)
- Log: `/api/home` fan-out count per request before vs. after demonstrates reduced upstream work (Spec § Success Metrics 3)
- CLI: `pnpm test:ci`, `pnpm typecheck`, `pnpm lint` all pass on the final state demonstrates zero regression (Spec § Success Metrics 4)

#### 4.0 Tasks

- [ ] 4.1 Re-run the exact Task 2.2/2.3 measurement procedure (same production-build setup, same favorites, cold + warm passes) on the optimized code.
- [ ] 4.2 Append a before/after table to `12-baseline-performance.md`: per-endpoint cold/warm durations and `/api/home` fan-out counts, with percentage change against baseline and pass/fail against the confirmed targets.
- [ ] 4.3 If a confirmed target is missed, report the gap to the user and STOP for a decision (iterate on Task 3.0 vs. accept and document) — do not silently proceed.
- [ ] 4.4 Run the full gate set one final time and commit as `docs(perf): record before/after performance evidence` with body `Related to T4.0 in Spec 12-spec-performance-optimization`.

### [ ] 5.0 Deliver prioritized code-quality findings document

#### 5.0 Proof Artifact(s)

- Document: `docs/specs/12-spec-performance-optimization/12-code-quality-findings.md` with prioritized (high/medium/low) findings, each carrying file reference, issue, impact, and suggested direction demonstrates the audit deliverable is actionable (FR 3.1, 3.3)
- Document: findings doc contains the `unstable_cache` → Cache Components migration evaluation with recommendation and scope estimate demonstrates the Q3 decision was recorded (FR 3.2)
- Diff: `git diff` of the spec's commits touches only instrumentation and Task 3.0 optimization code (plus docs) demonstrates no refactoring scope creep (FR 3.4)

#### 5.0 Tasks

- [ ] 5.1 Collect code-quality observations noted while working Tasks 1.0–4.0 (e.g. `lib/espn/client.ts` size/structure, duplicated `addDays` helpers in `lib/home/cache.ts` and `lib/home/aggregator.ts`, per-request `auth()` database session lookup, any dead or deprecated-alias code encountered).
- [ ] 5.2 Write `12-code-quality-findings.md`: one entry per finding with file reference, issue description, why it matters, suggested direction, and a high/medium/low priority; order by priority so a follow-up spec can be cut from the top.
- [ ] 5.3 Add the Cache Components evaluation section: read `node_modules/next/dist/docs/01-app/` on `cacheComponents` / `"use cache"`, then document what a migration of `lib/home/cache.ts` would entail, a recommendation, and a rough scope estimate.
- [ ] 5.4 Verify scope containment: review `git log`/`git diff` for the spec's commits and confirm code changes are limited to instrumentation and selected Task 3.0 optimizations; note the verification in the findings doc.
- [ ] 5.5 Commit as `docs(perf): add code-quality findings and cache migration evaluation` with body `Related to T5.0 in Spec 12-spec-performance-optimization`.
