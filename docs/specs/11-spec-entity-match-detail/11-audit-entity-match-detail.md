# 11-audit-entity-match-detail.md

## Executive Summary

- Overall Status: **PASS**
- Required Gate Failures: 0
- Flagged Risks: 2

## Gate Overview

| Gate | Status | Notes |
| --- | --- | --- |
| Requirement-to-test traceability | PASS | Every FR maps to ≥1 task and ≥1 planned test artifact (see mapping below). |
| Proof artifact verifiability | PASS | Artifacts are observable + reproducible (named test files, `GET` JSON excerpt, specific screenshots). |
| Repository standards consistency | PASS | 4 guideline sources read (`AGENTS.md`, `README.md`, `package.json`, `ci.yml`); no conflicts. |
| Open question resolution | PASS | Both spec Open Questions have explicit assumptions baked into tasks (see below). |
| Regression-risk blind spots | FLAG | Focus-on-recent + player fan-out are hard to fully cover with unit tests. |
| Non-goal leakage | FLAG | Minor: single-fetch vs. focus-refetch assumption to hold the line on "no live polling". |

## Standards Evidence Table

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | Next.js 16 App Router (read `node_modules/next/dist/docs/`); TS strict/no `any`; Tailwind v4 mobile-first, `min-h-dvh`, ≥44px targets; colocated Vitest; Conventional Commits | none |
| `README.md` | yes | Quality gates `pnpm lint`/`typecheck`/`test:ci`/`format:check`; Vitest + RTL | none |
| `package.json` | yes | Exact gate script names; no new migration needed | none |
| `.github/workflows/ci.yml` | yes (present) | Gates enforced on every PR | none |

## Requirement-to-Test Traceability (summary)

| Spec FR area | Task(s) | Planned test artifact |
| --- | --- | --- |
| Card-as-link + accessible label + ≥44px | 1.1 | `entity-card.test.tsx` (1.5) |
| Auth-gated detail route + not-found | 1.2, 1.3 | `teams/[favoriteId]/page.test.tsx` (1.5) |
| Header name+badge+back | 1.4 | `page.test.tsx` (1.5) |
| Endpoint full `Match[]`, user-scoped, auth | 2.3, 2.4 | `matches/route.test.ts` (2.6) |
| 10/10 cap | 2.2 | `route.test.ts` (2.6); `client.test.ts` (3.7) |
| `MatchCard` reuse (teams) | 2.5 | card routing in `entity-matches-client.test.tsx` (4.6) |
| Graceful degradation | 2.4, 3.5 | `route.test.ts` (2.6); `client.test.ts` (3.7) |
| Player full `Match[]` (team-sport + tennis) | 3.1–3.4 | `client.test.ts` (3.7) |
| Tennis detail + `TennisMatchCard` | 3.4, 3.6 | `client.test.ts` (3.7) + routing (4.6) |
| Chronological order + divider | 4.1, 4.2 | `entity-matches-client.test.tsx` (4.6) |
| Focus-on-recent | 4.3 | `scrollIntoView` spy in `entity-matches-client.test.tsx` (4.6) |
| Per-section + combined empty states | 4.4 | `entity-matches-client.test.tsx` (4.6) |

## Open Question Resolution (assumptions recorded)

1. **Player fan-out latency** → Assumption baked into 3.2: cap the item set *before* deep-resolving and parallelize; acceptable to tune caps if slow. No blocking decision needed.
2. **Re-fetch on focus** → Assumption: **single fetch on mount** (no live polling), per Non-Goal #2. Task 2.5 fetches once with an `AbortController`; focus-refetch intentionally omitted.

## Findings

### FLAG Findings

1. **Regression-risk: happy-path-weighted coverage for scroll + fan-out**
   - Risk: `scrollIntoView` (4.3) and player fan-out ordering (3.2) are behavior-heavy and only lightly unit-testable in jsdom; a green test suite may not catch layout-shift or off-by-one cap errors.
   - Suggested remediation: rely on the mandated mobile screenshots (4.7, 3.8) as the observable proof, and add an explicit boundary test in 3.7 for exactly-10 and fewer-than-10 cases. (Accepted as-is; no task change required.)

2. **Non-goal boundary: live polling**
   - Risk: `entity-matches-client.tsx` mirrors `TeamsClient`, which polls every 60s — copying it wholesale could reintroduce polling that Non-Goal #2 excludes.
   - Suggested remediation: 2.5 explicitly says "fetch once"; implementer must omit the `setInterval` poll block when adapting `TeamsClient`. (Documented; no task change required.)

## Chain-of-Verification

- All REQUIRED gates pass with explicit evidence (mapping table + standards table).
- Each finding verified against the spec (Non-Goals, Open Questions) and task file; both are FLAG-level, not REQUIRED failures.
- No unsupported findings remain.

## Final Status

- **PASS** — all REQUIRED gates green. Next action: proceed to `/SDD-3-manage-tasks`.
