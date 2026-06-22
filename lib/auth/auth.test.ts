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

  it("routes users to the spec-mandated custom pages", () => {
    expect(authConfig.pages?.signIn).toBe("/signin");
    expect(authConfig.pages?.verifyRequest).toBe("/check-email");
    expect(authConfig.pages?.error).toBe("/auth/error");
  });
});
