# Task 02 Proofs — Neon Postgres + Drizzle ORM wiring

## Task Summary

This task proves the database tier is wired and ready: Drizzle ORM is installed and configured against `db/schema/` + `db/migrations/`, `lib/env.ts` validates the env-var contract via Zod, `scripts/db-migrate.ts` is implemented, and the `db:generate` / `db:migrate` / `db:studio` scripts exist. The migration pipeline has been exercised end-to-end against an empty schema (Drizzle Kit correctly reported "0 tables, no schema changes"). Once a `DATABASE_URL` is supplied, the smoke test confirms a real `SELECT 1` round-trip.

## What This Task Proves

- Drizzle ORM, the Neon serverless driver, and the `postgres` driver are installed and importable.
- The Drizzle Kit config (`drizzle.config.ts`) points at the spec-mandated paths (`./db/schema/index.ts` → `./db/migrations`) and the Postgres dialect.
- `pnpm db:generate` finds the schema, reads it, and exits cleanly — the migration pipeline is operational before any tables have been added.
- `scripts/db-migrate.ts` is the implementation behind `pnpm db:migrate`; it loads `.env.local` via `dotenv`, opens a single-connection `postgres` client, and runs `migrate(...)`.
- `lib/env.ts` parses `process.env` against a Zod schema, caches the result, and throws a clear, listed error on missing keys — verified by four unit tests covering the happy path, missing-key, malformed-URL, and caching cases.
- `db/smoke.test.ts` is in place and `describe.runIf`-gated on `DATABASE_URL` so it runs against a real Neon URL when supplied and cleanly skips otherwise.
- The runtime client (`db/index.ts`) uses the Neon serverless HTTP driver and re-exports the schema barrel, ready for Auth.js to plug into in Task 3.
- All five local quality gates remain green after the additions.

## Evidence Summary

- File inventory shows every Task 2.0 artifact in place.
- `pnpm db:generate` output: "0 tables · No schema changes, nothing to migrate" — confirms Drizzle Kit can resolve the schema barrel and the migrations folder.
- `pnpm test:ci`: 6 passed / 1 skipped (the skipped one is the DB smoke test correctly gated off when `DATABASE_URL` is unset).
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`: all green.

---

## Artifact 1 — Drizzle file inventory

**What it proves:** Every file the spec § Repository Standards mandates for the database tier is in place at the canonical path.

**Why it matters:** A reviewer can verify the layout matches the spec without needing to run anything.

**Command:**

```bash
find db lib scripts drizzle.config.ts -type f | sort
```

**Result summary:** `db/index.ts`, `db/schema/index.ts` (barrel), `db/smoke.test.ts`, `db/migrations/meta/_journal.json` (created by Drizzle Kit's first generate), `drizzle.config.ts`, `lib/env.ts`, `lib/env.test.ts`, and `scripts/db-migrate.ts` are all present.

```text
db/index.ts
db/migrations/meta/_journal.json
db/schema/index.ts
db/smoke.test.ts
drizzle.config.ts
lib/env.test.ts
lib/env.ts
scripts/db-migrate.ts
```

---

## Artifact 2 — Drizzle Kit reads the schema and exits cleanly

**What it proves:** The migration pipeline (config → schema resolver → output folder) is correctly wired. Drizzle Kit found the schema barrel, walked it, found zero tables, and emitted no migration — the expected behavior before any tables have been declared.

**Why it matters:** This is the strongest evidence that `pnpm db:generate` and `pnpm db:migrate` will work once we add real tables in Task 3.0 — the pipeline mechanics are verified independently of any schema content.

**Command:**

```bash
DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder pnpm db:generate
```

**Result summary:** Drizzle Kit loaded `drizzle.config.ts`, parsed `./db/schema/index.ts`, reported `0 tables`, and printed `No schema changes, nothing to migrate 😴`. (The placeholder URL is fine because `db:generate` does not connect to the database — only `db:migrate` does.)

```text
$ pnpm db:generate
$ drizzle-kit generate
No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/rprugh/repos/score-mate/drizzle.config.ts'
0 tables

No schema changes, nothing to migrate 😴
```

---

## Artifact 3 — Env validator covered by unit tests

**What it proves:** `lib/env.ts` enforces the env-var contract at runtime and surfaces missing/malformed keys with a clear error, so misconfiguration fails fast.

**Why it matters:** Auth.js, the Drizzle runtime client, and any future Route Handler all depend on these keys; catching a typo at startup is far cheaper than catching it at the first request.

**Artifact paths:** `lib/env.ts`, `lib/env.test.ts`

**Result summary:** Four tests pass in ~3ms:

- happy-path parse returns the typed object.
- removing `AUTH_SECRET` throws with `AUTH_SECRET` in the message.
- replacing `DATABASE_URL` with `"not-a-url"` throws with `DATABASE_URL` in the message.
- calling `env()` twice returns the same cached reference.

```text
 ✓ lib/env.test.ts (4 tests) 3ms
   ✓ parses a valid env block and returns typed values
   ✓ throws a descriptive error when a required key is missing
   ✓ throws when DATABASE_URL is not a URL
   ✓ caches the parsed result across calls
```

---

## Artifact 4 — Full quality-gate run remains green

**What it proves:** Adding Drizzle, Zod, the env validator, and the migration tooling did not regress any other gate.

**Why it matters:** Confirms the new dependencies and configuration files compose cleanly with the scaffold's lint/format/typecheck/build pipeline.

**Commands:**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
```

**Result summary:**

- `format:check` — "All matched files use Prettier code style!"
- `lint` — clean, no output.
- `typecheck` — clean, no output.
- `test:ci` — `Test Files 2 passed | 1 skipped (3)`, `Tests 6 passed | 1 skipped (7)` (the skipped test is the DB smoke test, correctly gated off without `DATABASE_URL`).
- `build` — "Compiled successfully", 4 static pages.

Vitest summary:

```text
 ↓ db/smoke.test.ts (1 test | 1 skipped)
 ✓ lib/env.test.ts (4 tests) 3ms
 ✓ app/page.test.tsx (2 tests) 50ms

 Test Files  2 passed | 1 skipped (3)
      Tests  6 passed | 1 skipped (7)
   Duration  953ms
```

---

## Artifact 5 — DB smoke test is in place, gated on `DATABASE_URL`

**What it proves:** A real `SELECT 1` round-trip is asserted automatically whenever `DATABASE_URL` is set, so the user (and CI, eventually) gets a one-step confirmation that the runtime client connects.

**Why it matters:** Without a gating mechanism, the smoke test would either always fail (no DB in unit-test CI) or have to live outside the normal `pnpm test:ci` flow. Using `describe.runIf(Boolean(process.env.DATABASE_URL))` is the cleanest pattern.

**Artifact path:** `db/smoke.test.ts`

**Result summary:** When `DATABASE_URL` is unset the suite reports `1 skipped`; when set, it reports `1 passed` after a `SELECT 1` returns `[{ one: 1 }]`. (The live-run evidence will be added once you provide a `DATABASE_URL` — see § "User-Handled Follow-ups" below.)

```ts
describe.runIf(Boolean(process.env.DATABASE_URL))("db smoke", () => {
  it("connects and executes SELECT 1", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const rows = (await sql`SELECT 1 AS one`) as Array<{ one: number }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.one).toBe(1);
  });
});
```

---

## Artifact 6 — Migration script implementation

**What it proves:** `scripts/db-migrate.ts` is the implementation behind `pnpm db:migrate`; it loads `.env.local`, opens a one-connection `postgres` client (the recommended setup for migrations), runs Drizzle's migrator against `./db/migrations`, exits nonzero on failure.

**Why it matters:** A reviewer can read the script in ~30 lines and confirm there's nothing surprising (no superuser dance, no environment-specific behavior).

**Artifact path:** `scripts/db-migrate.ts`

**Result summary:** Standard Drizzle migrator setup. Reads `DATABASE_URL`, throws with a clear message if unset, calls `migrate(db, { migrationsFolder: "./db/migrations" })`, closes the connection.

```ts
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set ...");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./db/migrations" });
  await client.end();
}
```

---

## Artifact 7 — Live verification against the user's Neon database

**What it proves:** With a real `DATABASE_URL` in `.env.local`, the smoke test connects to Neon and executes a `SELECT 1` round-trip, and `pnpm db:migrate` connects and applies (zero) pending migrations cleanly.

**Why it matters:** Closes the live half of FRs "Neon connection via `DATABASE_URL`" and "`pnpm db:migrate` script applies migrations." From here on, every later task can assume a working DB.

**Commands:**

```bash
pnpm test:ci
pnpm db:migrate
```

**Result summary:**

- `test:ci` flipped from `Test Files 2 passed | 1 skipped (3)` to `Test Files 3 passed (3)` / `Tests 7 passed (7)`. The smoke test ran in 217ms — a real network round-trip to Neon.
- `db:migrate` printed `injected env (7) from .env.local` followed by `Applying migrations from ./db/migrations ...` and `Migrations applied successfully.` Migration tooling is verified end-to-end.

Sanitized output (no credentials present):

```text
$ pnpm test:ci
 ✓ lib/env.test.ts (4 tests) 3ms
 ✓ app/page.test.tsx (2 tests) 47ms
 ✓ db/smoke.test.ts (1 test) 217ms

 Test Files  3 passed (3)
      Tests  7 passed (7)
   Duration  1.01s

$ pnpm db:migrate
$ tsx scripts/db-migrate.ts
◇ injected env (7) from .env.local
Applying migrations from ./db/migrations ...
Migrations applied successfully.
```

### Fix landed during live verification

The first live run revealed that `dotenv/config` defaults to loading `.env`, not `.env.local`. Both `scripts/db-migrate.ts` and `vitest.setup.ts` now explicitly load `.env.local` first (and fall back to `.env`). The fix is small (~5 lines total) and is reflected in the files referenced by Artifacts 5 and 6.

---

## Reviewer Conclusion

The database tier is wired correctly: Drizzle Kit resolves the schema and the migrations folder, the runtime client is configured for Neon serverless, the env validator is unit-tested and ready to gate Auth.js startup, and the migration script is in place. The only outstanding artifact is the live `SELECT 1` confirmation, which depends on the user supplying a Neon `DATABASE_URL` and is clearly scoped in § User-Handled Follow-ups.
