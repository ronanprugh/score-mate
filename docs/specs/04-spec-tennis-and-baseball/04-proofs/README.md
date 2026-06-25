# Spec 04 Proof Artifact Index

Evidence for [04-spec-tennis-and-baseball](../04-spec-tennis-and-baseball.md). Baseball-only scope (Q1 (A)); Tennis deferred to Spec 05.

## Index

| Artifact | Path | Evidences |
| --- | --- | --- |
| Task 01 proofs | [04-task-01-proofs.md](./04-task-01-proofs.md) | Spec Unit 1 (FR-1 sport/league/allowlist registration); `pnpm typecheck` + `pnpm test:ci` clean after Baseball is added to `Sport`, `SUPPORTED_LEAGUES`, `SPORT_ALLOWLIST`, and the favorites validator. |
| Task 02 proofs | [04-task-02-proofs.md](./04-task-02-proofs.md) | Spec Unit 2 (FR-2 catalog refresh, FR-3 cache invalidation, FR-4 release note); integrated summary of catalog counts, breadth check, CI gates, touched-files, and cache-prefix change. |
| Catalog counts | [04-catalog-counts.md](./04-catalog-counts.md) | FR-2 — MLB (30) + NCAA D-I baseball (437) per-league team counts and whole-catalog totals (2142 teams across 21 leagues). |
| Breadth check | [04-breadth.txt](./04-breadth.txt) | FR-2 + Success Metric §5 — `yankees`, `dodgers`, `orioles`, `razorbacks` each return ≥ 1 Baseball hit from the committed catalog. |
| CI gate transcript | [04-ci-gates.txt](./04-ci-gates.txt) | Quality gates — `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build` all exit 0 (249/249 tests). |
| Touched-files list | [04-touched-files.txt](./04-touched-files.txt) | Success Metric §6 — combined diff for Spec 04 excludes `lib/home/aggregator.ts`, `app/api/home/route.ts`, `app/api/favorites/search/route.ts`, and `components/**`. |

## Verification commands (re-runnable)

```bash
# Catalog counts
jq '.teams | map(select(.sport == "Baseball")) | length' lib/espn/catalog.json
jq '[.teams[] | .sport] | unique' lib/espn/catalog.json

# Full CI gate suite
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:ci && pnpm build

# Success Metric §6 check
git diff --name-only origin/main..HEAD | grep -E '^(lib/home/aggregator\.ts|app/api/home/route\.ts|app/api/favorites/search/route\.ts|components/)' && echo "VIOLATION" || echo "OK"
```
