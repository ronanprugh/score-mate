import { config as loadEnv } from "dotenv";
import "@testing-library/jest-dom/vitest";

// Load .env.local so tests like db/smoke.test.ts can see developer-local
// secrets (e.g. DATABASE_URL). Falls back to .env if present.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
