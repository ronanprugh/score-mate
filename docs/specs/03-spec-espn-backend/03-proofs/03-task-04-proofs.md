# Task 04 Proofs — Tiered cache + favorites-reset migration

## Task Summary

This task proves the deploy-time reset of the `favorites` table runs cleanly, and ships the release note that operators need to understand the data wipe before they roll out. The tiered cache TTL implementation (originally T4.1–T4.3) shipped with Task 2 because `lib/home/cache.ts` had to be rewritten to match the new `Fetchers` interface in the same commit — splitting would have meant a broken intermediate state. This task focuses on the migration, the database-side verification, and the README release note.

## What This Task Proves

- A new Drizzle migration `0003_reset_favorites_for_espn.sql` exists; it contains a single `TRUNCATE TABLE "favorites"` statement with a comment referencing this SDD task.
- The migration journal (`db/migrations/meta/_journal.json`) registers the new entry with `idx: 3` so `pnpm db:migrate` picks it up.
- `pnpm db:migrate` applied successfully against the project's Neon database (per user authorization), and a post-migration count query returns `0` rows.
- `README.md` carries a one-line release note under **Operations → Release notes** documenting the swap and the data reset.
- All gates remain green (lint, typecheck, test:ci, format:check).
- The tiered cache work from T4.1–T4.3 is already in place from Task 2 (see [03-task-02-proofs.md](./03-task-02-proofs.md)); `chooseRevalidate` returns 30s/3600s/300s for today/yesterday/tomorrow respectively and the cache key prefix is `v3-espn`.

## Evidence Summary

- Migration file committed at `db/migrations/0003_reset_favorites_for_espn.sql`.
- Journal entry added at `db/migrations/meta/_journal.json`.
- `pnpm db:migrate` → "Migrations applied successfully."
- Post-migration `SELECT count(*) FROM favorites` returns 0.
- `README.md` shows the new release-note line.
- 241/241 tests pass; lint, typecheck, format:check all clean.

## Artifact: Migration SQL

**What it proves:** The deploy-time data reset is a single, auditable SQL statement with the SDD reference in-line.

**Artifact path:** `db/migrations/0003_reset_favorites_for_espn.sql`

**Result summary:** A short SQL file with a comment block explaining the rationale and a single `TRUNCATE TABLE "favorites"` statement.

```sql
-- Reset all favorites because Spec 03 swaps the data backend from
-- TheSportsDB to ESPN. Stored `external_id` values are TheSportsDB
-- ids (team `idTeam`, league `idLeague`, etc.) and don't map to ESPN.
-- Per Spec 03 Q4 answer (D): score-mate has no production users yet,
-- so a one-shot truncate is the cleanest path. Users re-favorite from
-- the new ESPN-backed search.
--
-- Related to T4.0 in Spec 03-spec-espn-backend
TRUNCATE TABLE "favorites";
```

## Artifact: Migration applied successfully

**What it proves:** The new migration is wired into the journal correctly and the migrator picks it up.

**Why it matters:** A migration that doesn't apply is worse than no migration — the deploy passes but the data layer doesn't get reset.

**Command:**

```bash
pnpm db:migrate
```

**Result summary:** Migrator logged "Migrations applied successfully." after the standard NOTICE messages about the existing `drizzle` schema (expected — schema/journal table predate this migration).

```
Applying migrations from ./db/migrations ...
Migrations applied successfully.
```

## Artifact: Favorites table is now empty

**What it proves:** The `TRUNCATE` actually ran against the user's database. This is the user-visible side effect the migration is responsible for.

**Command:**

```bash
node -e "
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
sql\`SELECT count(*)::int AS count FROM favorites\`.then((rows) => {
  console.log('favorites count:', rows[0].count);
  return sql.end();
});
"
```

**Result summary:** Post-migration row count is 0.

```
favorites count: 0
```

## Artifact: README release note

**What it proves:** Operators reading the README will see the data-wipe behavior documented before they roll out, with a pointer to the spec and the explicit migration filename.

**Diff:**

```diff
 ## Operations

+### Release notes
+
+- **2026-06-24 — Provider swap (Spec 03):** the data backend moved from TheSportsDB to ESPN. Migration `0003_reset_favorites_for_espn.sql` truncates the `favorites` table on deploy (Spec 03 Q4 (D) — no production users yet); users re-favorite from the new ESPN-backed search. Tennis is dropped from the supported-sports set in v1.
+
 ### Deploy to Vercel
```

## Artifact: Full CI gate suite still clean

**Command:**

```bash
pnpm lint && pnpm typecheck && pnpm test:ci && pnpm format:check
```

**Result summary:** All four gates pass; 241/241 tests green.

```
$ eslint
$ tsc --noEmit
 Test Files  29 passed (29)
      Tests  241 passed (241)
$ prettier --check .
All matched files use Prettier code style!
```

## Reviewer Conclusion

The favorites-reset migration is committed, journal-wired, applied against the real database, and documented in the README. Combined with the tiered cache work that shipped in Task 2, the user-visible data-layer changes for Spec 03 are now complete: cache TTLs are tiered, the deploy-time wipe is in place, and operators have a clear note explaining both. Task 5.0 will run the final cross-cutting verification (residue grep, dev-server screenshots, breadth check) and assemble the proof manifest.

## Notes on Scope Adjustment

- **T4.1–T4.3 (tiered TTLs + cache test):** shipped in Task 2's commit `9bb0f45` because `lib/home/cache.ts` had to be rewritten to match the new `Fetchers` interface. Evidence is in [03-task-02-proofs.md](./03-task-02-proofs.md).
- **Migration applied against the user's actual database** (authorized via explicit prompt). For a CI-only verification path, the Drizzle migrator is exercised whenever `pnpm db:migrate` runs.
