import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

const sql = neon(url);

/**
 * Runtime Drizzle client. Uses the Neon serverless HTTP driver so it works in
 * both Node and edge runtimes. For migrations and CLI scripts, use the
 * separate `postgres`-driver client in `scripts/db-migrate.ts`.
 */
export const db = drizzle(sql, { schema });
export type DB = typeof db;
