import { describe, expect, it } from "vitest";
import {
  CACHE_KEY_PREFIX,
  REVALIDATE_DEFAULT_SECONDS,
  REVALIDATE_TODAY_SECONDS,
  REVALIDATE_TOMORROW_SECONDS,
  REVALIDATE_YESTERDAY_SECONDS,
  chooseRevalidate,
  tennisActiveCacheKey,
} from "./cache";

const DATES = {
  yesterday: "2026-06-22",
  today: "2026-06-23",
  tomorrow: "2026-06-24",
} as const;

describe("chooseRevalidate", () => {
  it("today → 30s", () => {
    expect(chooseRevalidate(DATES.today, DATES)).toBe(REVALIDATE_TODAY_SECONDS);
    expect(REVALIDATE_TODAY_SECONDS).toBe(30);
  });

  it("yesterday → 3600s", () => {
    expect(chooseRevalidate(DATES.yesterday, DATES)).toBe(
      REVALIDATE_YESTERDAY_SECONDS,
    );
    expect(REVALIDATE_YESTERDAY_SECONDS).toBe(3600);
  });

  it("yesterday - 1 (widened neighbor) → 3600s", () => {
    expect(chooseRevalidate("2026-06-21", DATES)).toBe(
      REVALIDATE_YESTERDAY_SECONDS,
    );
  });

  it("tomorrow → 300s", () => {
    expect(chooseRevalidate(DATES.tomorrow, DATES)).toBe(
      REVALIDATE_TOMORROW_SECONDS,
    );
    expect(REVALIDATE_TOMORROW_SECONDS).toBe(300);
  });

  it("tomorrow + 1 (widened neighbor) → 300s", () => {
    expect(chooseRevalidate("2026-06-25", DATES)).toBe(
      REVALIDATE_TOMORROW_SECONDS,
    );
  });

  it("a date outside the widened-5 window falls back to default 300s", () => {
    expect(chooseRevalidate("2026-12-01", DATES)).toBe(
      REVALIDATE_DEFAULT_SECONDS,
    );
  });

  it("table: every widened-5 date maps to the bucket it neighbors", () => {
    const table: { date: string; expected: number }[] = [
      { date: "2026-06-21", expected: 3600 }, // yesterday - 1
      { date: "2026-06-22", expected: 3600 }, // yesterday
      { date: "2026-06-23", expected: 30 }, // today
      { date: "2026-06-24", expected: 300 }, // tomorrow
      { date: "2026-06-25", expected: 300 }, // tomorrow + 1
    ];
    for (const row of table) {
      expect(chooseRevalidate(row.date, DATES)).toBe(row.expected);
    }
  });
});

describe("CACHE_KEY_PREFIX", () => {
  // Spec 05: bumped from v6-espn-baseball → v7-espn-tennis so the deploy
  // invalidates cached results that pre-date Tennis + activeTennisTournaments.
  it("is v7-espn-tennis", () => {
    expect(CACHE_KEY_PREFIX).toBe("v7-espn-tennis");
  });

  it("tennisActiveCacheKey includes prefix, 'tennis-active', date, and tz", () => {
    const key = tennisActiveCacheKey("2025-06-02", "America/New_York");
    expect(key[0]).toBe(CACHE_KEY_PREFIX);
    expect(key).toContain("tennis-active");
    expect(key).toContain("2025-06-02");
    expect(key).toContain("America/New_York");
  });

  it("tennisActiveCacheKey: different timezones produce distinct keys for the same date", () => {
    // Bucketing depends on tz, so two timezones must not share a cache entry.
    const ny = tennisActiveCacheKey("2025-06-02", "America/New_York");
    const akl = tennisActiveCacheKey("2025-06-02", "Pacific/Auckland");
    expect(ny).not.toEqual(akl);
  });
});
