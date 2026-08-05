import { describe, expect, it } from "vitest";
import {
  COMPANION_LEAGUE_KEYS,
  companionLeagueKeys,
  findSupportedLeague,
  leagueKeysForSport,
  SUPPORTED_LEAGUES,
} from "./leagues";

describe("SUPPORTED_LEAGUES registry", () => {
  it("contains exactly the v1+baseball set: 2 football + 3 basketball + 14 soccer + 2 baseball = 21", () => {
    const bySport = new Map<string, number>();
    for (const l of SUPPORTED_LEAGUES) {
      bySport.set(l.sport, (bySport.get(l.sport) ?? 0) + 1);
    }
    expect(bySport.get("American Football")).toBe(2);
    expect(bySport.get("Basketball")).toBe(3);
    expect(bySport.get("Soccer")).toBe(14);
    expect(bySport.get("Baseball")).toBe(2);
    expect(SUPPORTED_LEAGUES).toHaveLength(21);
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
      expect(l.leagueKey).toMatch(/^(football|basketball|soccer|baseball)\//);
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

  it("Baseball returns mlb + college-baseball", () => {
    const keys = leagueKeysForSport("Baseball");
    expect(keys).toEqual(
      expect.arrayContaining(["baseball/mlb", "baseball/college-baseball"]),
    );
    expect(keys).toHaveLength(2);
  });
});

describe("findSupportedLeague", () => {
  it("returns the entry for a known soccer key", () => {
    expect(findSupportedLeague("soccer/fifa.world")).toEqual({
      leagueKey: "soccer/fifa.world",
      sport: "Soccer",
      displayName: "FIFA World Cup",
    });
  });

  it("returns the entry for the new MLB key", () => {
    expect(findSupportedLeague("baseball/mlb")).toEqual({
      leagueKey: "baseball/mlb",
      sport: "Baseball",
      displayName: "MLB",
    });
  });

  it("returns null for an unknown key", () => {
    expect(findSupportedLeague("hockey/nhl")).toBeNull();
  });

  it("resolves a companion-only league so friendlies get a display name", () => {
    expect(findSupportedLeague("soccer/club.friendly")).toEqual({
      leagueKey: "soccer/club.friendly",
      sport: "Soccer",
      displayName: "Club Friendly",
    });
  });
});

describe("companion leagues (Spec 13, Unit 2)", () => {
  it("keeps club.friendly out of the Home aggregator's fan-out", () => {
    // leagueKeysForSport drives lib/home/aggregator.ts:197. A friendly on a
    // followed team's card is wanted; friendlies in everyone's Home feed —
    // plus one extra scoreboard call per date — are not (Non-Goal #8).
    expect(leagueKeysForSport("Soccer")).not.toContain("soccer/club.friendly");
    expect(leagueKeysForSport("Soccer")).toHaveLength(14);
    expect(SUPPORTED_LEAGUES.map((l) => l.leagueKey)).not.toContain(
      "soccer/club.friendly",
    );
  });

  it("gives a Premier League team friendlies, both domestic cups, and the three UEFA competitions", () => {
    expect(companionLeagueKeys("soccer/eng.1")).toEqual([
      "soccer/club.friendly",
      "soccer/eng.fa",
      "soccer/eng.league_cup",
      "soccer/uefa.champions",
      "soccer/uefa.europa",
      "soccer/uefa.europa.conf",
    ]);
  });

  it("returns no companions for single-competition sports", () => {
    expect(companionLeagueKeys("football/nfl")).toEqual([]);
    expect(companionLeagueKeys("basketball/nba")).toEqual([]);
    expect(companionLeagueKeys("baseball/mlb")).toEqual([]);
  });

  it("returns no companions for an unknown league key", () => {
    expect(companionLeagueKeys("hockey/nhl")).toEqual([]);
  });

  it("returns a fresh array so callers cannot mutate the shared map", () => {
    const first = companionLeagueKeys("soccer/eng.1");
    first.push("soccer/made.up");
    expect(companionLeagueKeys("soccer/eng.1")).toHaveLength(6);
  });

  it("every companion key resolves to a known league", () => {
    for (const companions of Object.values(COMPANION_LEAGUE_KEYS)) {
      for (const key of companions) {
        expect(findSupportedLeague(key)).not.toBeNull();
      }
    }
  });
});
