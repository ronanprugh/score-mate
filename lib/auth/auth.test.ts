import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS, authConfig } from "@/auth.config";

describe("Auth.js configuration", () => {
  it("pins the session lifetime to 30 days", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(authConfig.session?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("uses the database session strategy (not JWT)", () => {
    expect(authConfig.session?.strategy).toBe("database");
  });

  it("registers both the Google and Resend providers", () => {
    const ids = authConfig.providers.map((p) => {
      // Auth.js providers expose either a top-level `id` (function form) or
      // `options.id`. Cover both shapes.
      const provider = p as { id?: string; options?: { id?: string } };
      return provider.id ?? provider.options?.id;
    });
    expect(ids).toContain("google");
    expect(ids).toContain("resend");
  });

  it("routes users to the spec-mandated custom pages (basePath-prefixed)", () => {
    // Auth.js appends page paths to the bare origin, so they must carry the
    // Next.js basePath prefix explicitly.
    expect(authConfig.pages?.signIn).toBe("/ScoreMate/signin");
    expect(authConfig.pages?.verifyRequest).toBe("/ScoreMate/check-email");
    expect(authConfig.pages?.error).toBe("/ScoreMate/auth/error");
  });

  it("leaves the Auth.js basePath at its /api/auth default", () => {
    // @auth/core uses basePath both to parse incoming (basePath-stripped)
    // request paths and to build absolute callback URLs, so it must stay at
    // the default — auth is served at the domain root via rewrites instead.
    expect(authConfig).not.toHaveProperty("basePath");
  });
});
