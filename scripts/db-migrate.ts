/**
 * Apply all pending Drizzle migrations to the database configured by
 * `DATABASE_URL`. Run via `pnpm db:migrate`. Exits non-zero on failure.
 *
 * Uses the standard `postgres` driver (not the Neon serverless HTTP driver)
 * because the migrator needs to run transactional DDL.
 */
import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Load .env.local first (developer-local secrets), then fall back to .env.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }

  // `max: 1` is the recommended setting for the migrator: one connection,
  // serialized DDL.
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("Applying migrations from ./db/migrations ...");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations applied successfully.");

  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});
