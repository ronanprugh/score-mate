import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitForTests, checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetRateLimitForTests();
  });

  it("allows the first request and reports remaining capacity", () => {
    const d = checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 });
    expect(d.ok).toBe(true);
    expect(d.remaining).toBe(59);
  });

  it("allows exactly `max` requests in the window, then denies the next one", () => {
    for (let i = 0; i < 60; i++) {
      const d = checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 });
      expect(d.ok).toBe(true);
    }
    const denied = checkRateLimit("user-a:write", {
      windowMs: 60_000,
      max: 60,
    });
    expect(denied.ok).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.resetMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 });
    }
    expect(
      checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 }).ok,
    ).toBe(false);

    // Advance past the window.
    vi.advanceTimersByTime(60_001);
    const afterReset = checkRateLimit("user-a:write", {
      windowMs: 60_000,
      max: 60,
    });
    expect(afterReset.ok).toBe(true);
    expect(afterReset.remaining).toBe(59);
  });

  it("scopes counters per key (one user's load doesn't block another)", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 });
    }
    expect(
      checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 }).ok,
    ).toBe(false);
    expect(
      checkRateLimit("user-b:write", { windowMs: 60_000, max: 60 }).ok,
    ).toBe(true);
  });

  it("does not count denied attempts (no double-punishment)", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 });
    }
    // Make 5 denied calls — they should not push out the oldest allowed call.
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-a:write", { windowMs: 60_000, max: 60 });
    }
    // Advance exactly the window past the first allowed call.
    vi.advanceTimersByTime(60_001);
    // Capacity should free up the oldest 1 allowed call, not be reset entirely.
    const next = checkRateLimit("user-a:write", {
      windowMs: 60_000,
      max: 60,
    });
    expect(next.ok).toBe(true);
  });
});
