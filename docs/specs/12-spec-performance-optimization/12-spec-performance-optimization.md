# 12-spec-performance-optimization.md

## Introduction/Overview

The deployed app feels slow, and there is currently no instrumentation to prove
where the time goes. This spec adds lightweight server-side timing to the data
endpoints, establishes a measured baseline, optimizes the dominant bottlenecks
on the production request path (with the home feed's upstream ESPN fan-out and
cache-key fragmentation as the leading suspects), and delivers a code-quality
findings document for improvements that are out of scope to fix here. The goal
is a measurably faster app with every improvement attributable to a recorded
before/after number.

## Goals

- Establish a numeric latency baseline (cold and warm) for the app's data endpoints before changing any behavior.
- Reduce measured server latency of the slowest endpoint(s), verified against the baseline with before/after numbers.
- Eliminate avoidable upstream work on the hot path (redundant ESPN calls, per-timezone cache fragmentation, duplicate in-flight fetches) without changing response shapes.
- Produce a prioritized code-quality findings document covering improvable code found during profiling, including a Next.js 16 Cache Components migration recommendation.
- Preserve all existing behavior: every existing test continues to pass and API response shapes are unchanged.

## User Stories

- **As a signed-in user**, I want the home feed to load and refresh quickly so that checking scores feels instant rather than sluggish.
- **As a signed-in user**, I want the Teams page and match-detail views to respond quickly so that navigating between entities doesn't feel heavier than the home feed.
- **As the developer/operator**, I want per-request timing and upstream call counts visible in logs so that I can see where latency comes from instead of guessing.
- **As the developer/operator**, I want a written list of code-quality findings so that I can plan follow-up cleanup work with evidence rather than intuition.

## Demoable Units of Work

### Unit 1: Server timing instrumentation and baseline report

**Purpose:** Make latency observable so optimization targets the real bottleneck. Serves the developer/operator.

**Functional Requirements:**

- The system shall record, for each request to the data route handlers (`/api/home`, `/api/teams`, `/api/teams/[favoriteId]/matches`, `/api/favorites/search`), the total handler duration in milliseconds.
- The system shall record, for each `/api/home` request, the number of upstream fetcher invocations planned (league keys × dates, plus tennis tournament calls) so fan-out size is visible per request.
- The system shall expose these measurements via structured server log lines (and a `Server-Timing` response header on the data routes) without altering any response body.
- The system shall keep instrumentation overhead negligible (no additional upstream calls, no synchronous I/O added to the hot path).
- The developer shall capture a baseline document `12-baseline-performance.md` in this spec directory recording cold-cache and warm-cache timings for each instrumented endpoint against the deployed or locally-built (`next build` + `next start`) app.

**Proof Artifacts:**

- Log excerpt: structured timing lines from a `next start` session demonstrates instrumentation emits per-request durations and fan-out counts.
- HTTP response capture: `curl -sD -` output showing the `Server-Timing` header on `/api/home` demonstrates timing is exposed per response without body changes.
- Document: `12-baseline-performance.md` with cold/warm numbers per endpoint demonstrates the baseline exists and numeric targets can be derived from it.
- Test: existing route and aggregator tests pass (`pnpm test:ci`) demonstrates instrumentation changed no behavior.

### Unit 2: Hot-path optimization of the measured bottlenecks

**Purpose:** Reduce real user-facing latency on the production request path, guided by Unit 1's baseline. Serves signed-in users.

Candidate optimizations, to be prioritized by the baseline (highest measured cost first):

1. **Tennis cache fragmentation** — the tennis-active cache is keyed by (day, timezone), so every distinct user timezone pays its own cold fan-out; restructure so the expensive upstream fetch is shared and timezone bucketing is applied cheaply after.
2. **Fan-out reduction** — `/api/home` fetches league keys × 5 dates plus 3 days × all marquee tennis tournaments on a miss; skip or narrow calls that cannot contribute matches (e.g., tournaments already known inactive, duplicate day windows).
3. **Duplicate in-flight requests** — concurrent renders/polls triggering identical upstream fetches should coalesce to one in-flight call.
4. **Polling cost** — the home client re-fetches the full envelope every 60 seconds; reduce transfer or server work for unchanged data if the baseline shows this matters.

**Functional Requirements:**

- The system shall implement the highest-impact optimization(s) identified by the baseline, chosen from the candidate list above (or a newly discovered bottleneck if the baseline reveals one, documented in the proof).
- The system shall reduce the warm-path and/or cold-path latency of the slowest instrumented endpoint relative to the Unit 1 baseline, with the improvement recorded as before/after numbers.
- The system shall not change any API response shape, bucketing semantics (local-date assignment of matches), or visible UI behavior.
- The system shall keep partial-failure semantics intact: upstream errors still surface via `source.errors` with a 200 response.
- The system shall retain the tiered TTL model built on `unstable_cache` (no Cache Components migration in this spec).

**Proof Artifacts:**

- Document: before/after table appended to `12-baseline-performance.md` demonstrates measured improvement on the targeted endpoint(s).
- Log excerpt: fan-out count per `/api/home` request before vs. after demonstrates reduced upstream work.
- Test: new unit tests for changed modules plus all existing tests passing (`pnpm test:ci`) demonstrates behavior preservation.
- CLI: `pnpm typecheck` and `pnpm lint` clean demonstrates quality gates hold.

### Unit 3: Code-quality findings document

**Purpose:** Deliver the "find places where code can be improved" half of the request as an actionable, prioritized document — analysis only, no fixes. Serves the developer/operator.

**Functional Requirements:**

- The developer shall produce `12-code-quality-findings.md` in this spec directory listing improvable code found during Units 1–2, each entry with: file reference, description of the issue, why it matters, and a suggested direction.
- The document shall include a section evaluating migration from `unstable_cache` to Next.js 16 Cache Components (`cacheComponents` + `"use cache"`), with a recommendation and rough scope estimate.
- The document shall prioritize findings (e.g., high/medium/low) so a follow-up spec can be cut from the top of the list.
- The document shall not be accompanied by refactoring changes — code edits in this spec are limited to Units 1 and 2.

**Proof Artifacts:**

- Document: `12-code-quality-findings.md` with prioritized findings and the Cache Components section demonstrates the audit deliverable exists and is actionable.
- Diff review: the spec's final diff touches only instrumentation and Unit 2 optimization code demonstrates no scope creep into refactoring.

## Non-Goals (Out of Scope)

1. **Code-quality refactoring**: improvable code is documented in Unit 3, not fixed here (per clarification Q2 = A).
2. **Cache Components migration**: the app stays on `unstable_cache`; migration is a recommendation in the findings document only (per clarification Q3 = C).
3. **Local development toolchain performance**: `next dev` startup/compile speed is not addressed (slowness reported on the deployed app, Q1 = A).
4. **Dependency changes**: the dependency footprint is already lean; no packages are added or removed except, if strictly needed, a dev-only measurement helper.
5. **UI/UX changes**: no visual or interaction changes; polling cadence may only change if the baseline proves it necessary and the user approves it.
6. **New product features**: no new endpoints, pages, or data beyond timing metadata.

## Design Considerations

No user-visible design changes. Instrumentation output is developer-facing only (logs and a `Server-Timing` header, which browsers surface in DevTools without UI impact).

## Repository Standards

- Next.js 16 App Router conventions; consult `node_modules/next/dist/docs/` before writing framework-touching code (per AGENTS.md).
- TypeScript `strict`, no `any`, no unexplained `@ts-ignore`.
- Colocated Vitest + React Testing Library tests (`foo.ts` next to `foo.test.ts`); `pnpm test:ci`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` must pass.
- Conventional Commits referencing this spec's tasks (e.g., `perf(home): ... Related to T2.1 in Spec 12-spec-performance-optimization`).
- Dependency injection pattern for fetchers (as in `lib/home/aggregator.ts`) is the established seam — instrumentation and optimization should use it rather than global monkey-patching.
- Spec documents, baselines, and findings live in `docs/specs/12-spec-performance-optimization/`.

## Technical Considerations

- **Measure before optimizing** (clarification Q4 = A): Unit 2 must not start until Unit 1's baseline exists; numeric targets in Success Metrics are derived from that baseline.
- **Caching model**: stay on `unstable_cache` with the existing tiered TTLs (30s today / 5m tomorrow / 1h yesterday). The Next.js 16 docs describe this as the supported previous model; the successor (Cache Components) is evaluated in Unit 3 only.
- **Timezone-key fragmentation**: `cachedActiveTennisTournaments` keys on `(today, tz)`; a fix must preserve correct local-date bucketing of competitions while sharing the expensive upstream fetch across timezones — bucketing is cheap and can run outside the cache boundary.
- **`Server-Timing` header**: standard, additive, and safe — it does not affect caching or response bodies and is the current lightweight practice for exposing server-side latency to DevTools.
- **Baseline environment**: production-equivalent (`next build` + `next start`, or the deployed app) — `next dev` timings are not representative.
- **Known constraint**: `auth()` uses database sessions, so each API request includes a session lookup; if the baseline shows this dominating, the finding goes to Unit 3 (changing session strategy is an auth-architecture decision, not a hot-path tweak).

## Security Considerations

- Timing logs and `Server-Timing` values must not include user identifiers, session tokens, favorite contents, or upstream URLs with query secrets — durations, route names, and counts only.
- Baseline and findings documents committed to the repo must not contain real session cookies, tokens, or `.env` values; capture proof artifacts with redacted headers.
- No new secrets, endpoints, or auth-surface changes are introduced.

## Success Metrics

1. **Baseline exists**: `12-baseline-performance.md` records cold and warm timings for all four instrumented endpoints before any optimization lands.
2. **Measured improvement**: the slowest baseline endpoint shows a recorded latency reduction after Unit 2, with numeric before/after evidence (target percentage set from the baseline per clarification Q4; to be written into the baseline doc when measured).
3. **Reduced upstream work**: per-request fan-out counts for `/api/home` decrease (or cache hit rate increases) between baseline and post-optimization logs.
4. **Zero regression**: `pnpm test:ci`, `pnpm typecheck`, and `pnpm lint` pass; API response shapes are byte-compatible for identical inputs (excluding the additive `Server-Timing` header).
5. **Actionable audit**: `12-code-quality-findings.md` contains prioritized findings including the Cache Components evaluation.

## Open Questions

1. Numeric latency targets (e.g., "warm p95 under N ms") are intentionally deferred until the Unit 1 baseline exists; they will be recorded in `12-baseline-performance.md` and confirmed with the user before Unit 2 begins.
2. If the baseline shows client-side polling (60s full-envelope refetch) as a dominant cost, does the user approve changing polling behavior (cadence or conditional requests), or should that be deferred to a follow-up spec?
