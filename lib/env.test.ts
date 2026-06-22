import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetEnvCacheForTests, env } from "./env";

const ORIGINAL_ENV = { ...process.env };

const VALID = {
  DATABASE_URL: "postgres://user:pw@localhost:5432/scoremate",
  AUTH_SECRET: "test-secret-not-used-in-prod",
  NEXTAUTH_URL: "http://localhost:3000",
  AUTH_GOOGLE_ID: "google-id",
  AUTH_GOOGLE_SECRET: "google-secret",
  AUTH_RESEND_KEY: "resend-key",
  EMAIL_FROM: "no-reply@example.com",
} as const;

function setEnv(values: Partial<Record<string, string>>) {
  // Wipe all our keys, then set what the test wants.
  for (const k of Object.keys(VALID)) delete process.env[k];
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) process.env[k] = v;
  }
}

describe("env()", () => {
  beforeEach(() => {
    _resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    _resetEnvCacheForTests();
  });

  it("parses a valid env block and returns typed values", () => {
    setEnv(VALID);
    const e = env();
    expect(e.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(e.AUTH_SECRET).toBe(VALID.AUTH_SECRET);
    expect(e.EMAIL_FROM).toBe(VALID.EMAIL_FROM);
  });

  it("throws a descriptive error when a required key is missing", () => {
    setEnv({ ...VALID, AUTH_SECRET: undefined });
    expect(() => env()).toThrow(/AUTH_SECRET/);
  });

  it("throws when DATABASE_URL is not a URL", () => {
    setEnv({ ...VALID, DATABASE_URL: "not-a-url" });
    expect(() => env()).toThrow(/DATABASE_URL/);
  });

  it("caches the parsed result across calls", () => {
    setEnv(VALID);
    const a = env();
    const b = env();
    expect(a).toBe(b);
  });
});
