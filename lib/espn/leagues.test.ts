import { describe, expect, it } from "vitest";
import {
  findSupportedLeague,
  leagueKeysForSport,
  SUPPORTED_LEAGUES,
} from "./leagues";

describe("SUPPORTED_LEAGUES registry", () => {
  it("contains exactly the v1 set: 2 football + 3 basketball + 14 soccer", () => {
    const bySport = new Map<string, number>();
    for (const l of SUPPORTED_LEAGUES) {
      bySport.set(l.sport, (bySport.get(l.sport) ?? 0) + 1);
    }
    expect(bySport.get("American Football")).toBe(2);
    expect(bySport.get("Basketball")).toBe(3);
    expect(bySport.get("Soccer")).toBe(14);
    expect(SUPPORTED_LEAGUES).toHaveLength(19);
  });

  it("does not contain Tennis", () => {
    const tennis = SUPPORTED_LEAGUES.filter(
      (l) => (l.sport as string) === "Tennis",
    );
    expect(tennis).toEqual([]);
  });

  it("every league key is unique", () => {
    const keys = SUPPORTED_LEAGUES.map((l) => l.leagueKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every league key uses the {sport}/{league} ESPN URL shape", () => {
    for (const l of SUPPORTED_LEAGUES) {
      expect(l.leagueKey).toMatch(/^(football|basketball|soccer)\//);
    }
  });
});

describe("leagueKeysForSport", () => {
  it("Soccer expands to all 14 soccer keys", () => {
    expect(leagueKeysForSport("Soccer")).toHaveLength(14);
  });

  it("Basketball returns nba, wnba, mens-college-basketball", () => {
    const keys = leagueKeysForSport("Basketball");
    expect(keys).toEqual(
      expect.arrayContaining([
        "basketball/nba",
        "basketball/wnba",
        "basketball/mens-college-basketball",
      ]),
    );
    expect(keys).toHaveLength(3);
  });

  it("American Football returns nfl + college-football", () => {
    expect(leagueKeysForSport("American Football")).toEqual(
      expect.arrayContaining(["football/nfl", "football/college-football"]),
    );
  });
});

describe("findSupportedLeague", () => {
  it("returns the entry for a known key", () => {
    expect(findSupportedLeague("soccer/fifa.world")).toEqual({
      leagueKey: "soccer/fifa.world",
      sport: "Soccer",
      displayName: "FIFA World Cup",
    });
  });

  it("returns null for an unknown key", () => {
    expect(findSupportedLeague("hockey/nhl")).toBeNull();
  });
});
