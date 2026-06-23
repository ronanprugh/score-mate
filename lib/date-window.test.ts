import { describe, expect, it } from "vitest";
import { computeDateWindow } from "./date-window";

describe("computeDateWindow", () => {
  it("boring case: UTC noon → today/yesterday/tomorrow are the obvious dates", () => {
    const now = new Date("2026-06-22T12:00:00Z");
    expect(computeDateWindow(now, "UTC")).toEqual({
      yesterday: "2026-06-21",
      today: "2026-06-22",
      tomorrow: "2026-06-23",
    });
  });

  it("America/New_York at 23:30 LOCAL on 2026-06-22 is still 'today=06-22' locally even though UTC is 03:30 06-23", () => {
    // 2026-06-22 23:30 EDT (UTC-4) = 2026-06-23 03:30 UTC
    const now = new Date("2026-06-23T03:30:00Z");
    const w = computeDateWindow(now, "America/New_York");
    expect(w.today).toBe("2026-06-22");
    expect(w.yesterday).toBe("2026-06-21");
    expect(w.tomorrow).toBe("2026-06-23");
  });

  it("Pacific/Kiritimati (+14) at 00:30 LOCAL: today is already tomorrow-from-UTC", () => {
    // 2026-06-23 00:30 Kiritimati (UTC+14) = 2026-06-22 10:30 UTC
    const now = new Date("2026-06-22T10:30:00Z");
    const w = computeDateWindow(now, "Pacific/Kiritimati");
    expect(w.today).toBe("2026-06-23");
    expect(w.yesterday).toBe("2026-06-22");
    expect(w.tomorrow).toBe("2026-06-24");
  });

  it("DST 'spring forward' day in America/New_York rolls correctly (2026-03-08)", () => {
    // 2026-03-08 04:00 UTC = 2026-03-08 00:00 EST → 01:00 → 03:00 EDT (DST jump)
    // Take noon UTC; local should be 08:00 EDT on the 8th.
    const now = new Date("2026-03-08T12:00:00Z");
    expect(computeDateWindow(now, "America/New_York")).toEqual({
      yesterday: "2026-03-07",
      today: "2026-03-08",
      tomorrow: "2026-03-09",
    });
  });

  it("end of February to start of March (leap-year boundary, 2028)", () => {
    const now = new Date("2028-02-29T12:00:00Z");
    expect(computeDateWindow(now, "UTC")).toEqual({
      yesterday: "2028-02-28",
      today: "2028-02-29",
      tomorrow: "2028-03-01",
    });
  });

  it("strings are always YYYY-MM-DD format (zero-padded)", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const w = computeDateWindow(now, "UTC");
    expect(w.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(w.today).toBe("2026-01-05");
  });
});
