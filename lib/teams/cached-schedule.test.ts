import { describe, expect, it } from "vitest";
import { scheduleCacheKey } from "./cached-schedule";

describe("scheduleCacheKey (Spec 13, Unit 1 FR6 / Unit 2 FR4)", () => {
  it("includes the league key, team id, and season", () => {
    expect(scheduleCacheKey("soccer/eng.1", "364", 2026)).toEqual([
      "teams-team-schedule",
      "soccer/eng.1",
      "364",
      "2026",
    ]);
  });

  it("produces distinct keys for two seasons", () => {
    // Without the season, a previous-season fallback result would be served
    // after the new season publishes fixtures — a stale screen replacing the
    // empty one this spec set out to fix.
    expect(scheduleCacheKey("soccer/eng.1", "364", 2026)).not.toEqual(
      scheduleCacheKey("soccer/eng.1", "364", 2025),
    );
  });

  it("produces distinct keys per competition so leagues cache independently", () => {
    expect(scheduleCacheKey("soccer/eng.1", "364", 2026)).not.toEqual(
      scheduleCacheKey("soccer/club.friendly", "364", 2026),
    );
  });

  it("produces distinct keys per team", () => {
    expect(scheduleCacheKey("soccer/eng.1", "364", 2026)).not.toEqual(
      scheduleCacheKey("soccer/eng.1", "359", 2026),
    );
  });
});
