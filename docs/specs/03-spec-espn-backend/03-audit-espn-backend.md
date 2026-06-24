# 03-audit-espn-backend.md

## Executive Summary

- Overall Status: **PASS**
- Required Gate Failures: 0
- Flagged Risks: 2

## Gateboard

| Gate | Status | Why it failed (<=10 words) | Exact fix target |
| --- | --- | --- | --- |
| Requirement-to-test traceability | PASS | — | — |
| Proof artifact verifiability | PASS | — | — |
| Repository standards consistency | PASS | — | — |
| Open question resolution | PASS | — | — |
| Regression-risk blind spots | FLAG | Cache-prefix bump unverified post-deploy | `## Tasks > 5.0` |
| Non-goal leakage | FLAG | Soccer fan-out volume risks ESPN throttling | `## Tasks > 2.0` |

## Standards Evidence Table

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | Next 16 App Router only; TS strict, no `any`; mobile-first Tailwind v4; Drizzle schemas in `db/schema/`, migrations in `db/migrations/`; colocated `*.test.ts(x)`; Conventional Commits referencing SDD task; env via `lib/env.ts`; no future-spec scope. | none |
| `CLAUDE.md` | yes | Delegates to `@AGENTS.md`. | none |
| `README.md` | yes | Scripts: `pnpm lint / format:check / typecheck / test:ci / build / db:migrate`; Drizzle generate→commit→migrate flow; `.env.local` never committed. | none |
| `.github/workflows/ci.yml` | yes | CI = lint → format:check → typecheck → test:ci → build; pnpm 11 / Node 22; all gates must pass. | none |
| `package.json` | yes | Vitest for tests; `tsx` for scripts; `zod` available; no new HTTP-client dep (`fetch`). | none |

## Findings

### FLAG Findings

1. **Cache-key prefix bump cold-start unobserved**
   - Risk: Bumping `v2-utc` → `v3-espn-...` invalidates all prior `unstable_cache` keys on deploy. The first request after deploy will fan out 14 soccer leagues × 5 dates uncached, which could spike ESPN call volume and homepage latency.
   - Suggested remediation: Add a sub-task under §5.0 to manually exercise the first post-deploy request (or a synthetic cold-cache run locally with `unstable_cache` disabled) and capture observed latency. No spec change required — just an additional verification step.

2. **14-soccer-league fan-out volume**
   - Risk: A user with any Soccer favorite triggers `14 leagues × 5 dates = 70` ESPN requests per `/api/home` call (uncached or partially-cached). Spec Open Question §1 already flagged this; user explicitly chose "keep all" leagues. Not a non-goal leak, but the volume is worth a single empirical check.
   - Suggested remediation: Capture one cold-cache request count and total latency during §5.0 verification; if it exceeds a reasonable threshold (e.g. >5s p50), open a follow-up issue to revisit the trim.

## User-Approved Remediation Plan

- Approved (2026-06-24): Both FLAG findings remediated by adding new sub-tasks T5.7 (cold-cache observation) and T5.8 (soccer fan-out p50 check) under parent task §5.0.

## Re-Audit Delta (Run 2)

- Changed gate statuses since previous run: none (all REQUIRED still PASS).
- Still-failing REQUIRED gates: none.
- Flag findings resolved: §1 (cold-cache) → covered by T5.7; §2 (soccer fan-out volume) → covered by T5.8.
- Overall Status: **PASS** with zero open flags.
