# 12 Questions Round 1 - Performance Optimization

Please answer each question below (select one or more options, or add your own notes). Feel free to add additional context under any question.

**Context from an initial codebase review** (to ground your answers): the dependency
footprint is lean, so "bloat" in the `node_modules` sense is unlikely. The more
probable slowness sources are: (a) the home feed's upstream fan-out — one ESPN
scoreboard call per (league key × 5 dates) plus ~3 days × N marquee tennis
tournaments per request on a cache miss; (b) the tennis-active cache being keyed
per-timezone, so each distinct user TZ pays its own cold fan-out; (c) `auth()`
doing a database session lookup on every request (database session strategy);
and (d) the home client re-fetching the full envelope every 60 seconds. There is
currently no timing instrumentation, so we can't yet prove which of these
dominates.

## 1. Where do you feel the slowness?

Knowing the environment and surface determines whether this spec targets server
latency, caching, client rendering, or the dev toolchain. (Select all that apply.)

- [X] (A) The deployed production app — pages/feeds are slow to load or refresh
- [ ] (B) Local development — `next dev` is slow to start, compile, or hot-reload
- [ ] (C) A specific surface (home feed, Teams page, entity match detail, sign-in) — name it in notes
- [X] (D) Everywhere / not sure — I just want it profiled and fixed wherever it's worst
- [ ] (E) Other (describe)

**Recommended answer(s):** [(C) if you can name a surface, otherwise (D)]

**Why these are recommended:**

- `(C)` gives the spec a concrete demoable unit ("home feed loads in under X seconds") instead of a vague "make it fast," which makes validation and proof artifacts unambiguous.
- `(D)` is still workable because the spec can lead with a measurement/instrumentation unit that identifies the worst offender before optimizing — but it makes the spec slightly larger.
- `(B)` alone would change the spec entirely (toolchain tuning, not app code), so it's important to distinguish it from `(A)`/`(C)`.

## 2. How should we split performance work from general code-quality cleanup?

You asked for both "make it run quickly" and "find places where code can be
improved." Those are different kinds of work with different proof artifacts.

- [X] (A) This spec covers performance only; code-quality findings are recorded in an audit document as a deliverable, but fixes are out of scope
- [ ] (B) This spec covers performance plus low-risk code cleanups in the files it already touches
- [ ] (C) One big spec covering performance and a full code-quality refactor pass
- [ ] (D) Two specs: this one for performance, a follow-up spec generated from the audit findings
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` keeps every functional requirement testable ("endpoint p95 improved from X to Y") while still delivering the "find improvable code" half of your request as a concrete audit artifact you can act on later.
- `(C)` is a scope-assessment red flag — "refactor multiple interconnected modules simultaneously" is explicitly the too-large pattern for this workflow, and mixing behavior-preserving refactors with performance changes makes regressions hard to attribute.
- `(D)` is a fine alternative if you already know you want the cleanup done; it just commits you to a second spec cycle now rather than deciding after seeing the audit.

## 3. Which caching model should the optimization build on?

The app caches ESPN responses with `unstable_cache` and tiered TTLs
(30s/5m/1h). Next.js 16 documents this as the "previous model" and introduces
Cache Components (`cacheComponents: true` + `"use cache"`) as the current
approach.

- [ ] (A) Keep `unstable_cache` and optimize within it (fix per-timezone key fragmentation, tune TTLs, add request-level deduplication)
- [] (B) Migrate the caching layer to Next.js 16 Cache Components as part of this spec
- [X] (C) Keep `unstable_cache` now, but record a migration recommendation in the audit document
- [ ] (D) Other (describe)

**Current best-practice context:** The Next.js 16 docs bundled in this repo label `unstable_cache` as the previous, still-supported model and position Cache Components as the successor. It is not deprecated-with-removal-date, so staying on it is a legitimate choice; migrating is a structural change touching every cached fetcher.

**Recommended answer(s):** [(C)]

**Why these are recommended:**

- `(C)` keeps this spec's diff small and attributable — the likely wins (cache-key fragmentation, fan-out reduction, request dedup) don't require changing cache technology — while still capturing the migration as tracked future work.
- `(B)` mixes an infrastructure migration into a performance spec, which makes it hard to tell whether an improvement (or regression) came from the migration or the optimization; it's better as its own spec.
- `(A)` is nearly as good but silently drops the migration question, which will resurface every time someone reads the v16 docs.

## 4. What does "fast enough" mean — and should we measure first?

Success metrics need a target, and right now there is no instrumentation to
establish a baseline.

- [X] (A) Yes — first demoable unit is instrumentation (server timing on API routes + upstream fan-out counts), then set numeric targets from the measured baseline
- [ ] (B) I have targets in mind already (write them in notes, e.g. "home feed under 1s warm, under 3s cold")
- [ ] (C) No formal measurement — just fix the obvious inefficiencies and eyeball the result
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` makes every later requirement provable ("p95 dropped from X to Y" is a proof artifact; "feels faster" is not), and the instrumentation itself is a small, demoable vertical slice.
- `(C)` risks optimizing the wrong thing — e.g. spending effort on bundle size when the real cost is upstream fan-out latency — and leaves the spec without meaningful success metrics.
- If you pick `(B)`, the instrumentation from `(A)` is still needed to verify the targets, so `(A)` largely subsumes it.
