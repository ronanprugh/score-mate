import { describe, expect, it } from "vitest";

/**
 * Live DB smoke test. Skips when `DATABASE_URL` is unset (e.g. CI without a
 * test branch), so it never blocks the unit-test suite. To run it, set
 * `DATABASE_URL` to a reachable Postgres URL (Neon test branch recommended)
 * and invoke `pnpm test:ci db/smoke.test.ts`.
 */
describe.runIf(Boolean(process.env.DATABASE_URL))("db smoke", () => {
  it("connects and executes SELECT 1", async () => {
    // Import lazily so the unit suite doesn't pull in the Neon driver when
    // DATABASE_URL is unset.
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const rows = (await sql`SELECT 1 AS one`) as Array<{ one: number }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.one).toBe(1);
  });
});
