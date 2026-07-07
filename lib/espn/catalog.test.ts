import { describe, expect, it } from "vitest";
import {
  ALL_CATALOG_LEAGUES,
  ALL_CATALOG_TEAMS,
  findCatalogTeamById,
  searchCatalogLeagues,
  searchCatalogTeams,
} from "./catalog";

describe("ESPN catalog shape", () => {
  it("ships ≥ 1900 teams across the supported leagues", () => {
    expect(ALL_CATALOG_TEAMS.length).toBeGreaterThanOrEqual(1900);
  });

  it("contains team sports (no Tennis — players not in catalog)", () => {
    const sports = new Set(ALL_CATALOG_TEAMS.map((t) => t.sport));
    expect(sports).toEqual(
      new Set(["American Football", "Baseball", "Basketball", "Soccer"]),
    );
  });

  it("league count matches the v1 registry (2 + 3 + 14 + 2 + 23 Tennis = 44)", () => {
    expect(ALL_CATALOG_LEAGUES).toHaveLength(44);
  });

  it("every team carries a leagueKey using the {sport}/{league} ESPN shape", () => {
    for (const t of ALL_CATALOG_TEAMS) {
      expect(t.leagueKey).toMatch(/^(football|basketball|baseball|soccer)\//);
    }
  });
});

describe("findCatalogTeamById — disambiguation (ESPN ids collide across sports)", () => {
  it("resolves the right team when the id maps to a different team in other sports", () => {
    // id `9` = Green Bay Packers (NFL), Golden State Warriors (NBA), Arizona
    // State (college), Minnesota Twins (MLB) — all share id 9.
    const packers = findCatalogTeamById(
      "9",
      "American Football",
      "Green Bay Packers",
    );
    expect(packers?.name).toBe("Green Bay Packers");
    expect(packers?.leagueKey).toBe("football/nfl");

    // id `4` = Chicago Bulls (NBA) but also collides with an NFL team.
    const bulls = findCatalogTeamById("4", "Basketball", "Chicago Bulls");
    expect(bulls?.name).toBe("Chicago Bulls");
    expect(bulls?.leagueKey).toBe("basketball/nba");
  });

  it("disambiguates same-sport, different-league id collisions via displayName", () => {
    // Within American Football, id `9` is BOTH the Packers (nfl) and Arizona
    // State (college-football); the name breaks the tie.
    const asu = findCatalogTeamById(
      "9",
      "American Football",
      "Arizona State Sun Devils",
    );
    expect(asu?.leagueKey).toBe("football/college-football");
  });

  it("falls back gracefully when name doesn't match but sport is unique", () => {
    const bySport = findCatalogTeamById("4", "Basketball", "Nonexistent Name");
    expect(bySport?.sport).toBe("Basketball");
  });

  it("returns null for an id absent from the catalog", () => {
    expect(findCatalogTeamById("no-such-id", "Soccer", "Nobody")).toBeNull();
  });
});

describe("searchCatalogTeams — substring and sport filter", () => {
  it("empty query returns []", () => {
    expect(searchCatalogTeams("")).toEqual([]);
    expect(searchCatalogTeams("   ")).toEqual([]);
  });

  it("'arsenal' finds Arsenal (Premier League)", () => {
    const hits = searchCatalogTeams("arsenal");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((t) => t.name === "Arsenal" && t.sport === "Soccer")).toBe(
      true,
    );
  });

  it("'lakers' finds the LA Lakers (NBA)", () => {
    const hits = searchCatalogTeams("lakers");
    expect(
      hits.some(
        (t) =>
          t.name === "Los Angeles Lakers" && t.leagueKey === "basketball/nba",
      ),
    ).toBe(true);
  });

  it("'chiefs' finds the KC Chiefs (NFL)", () => {
    const hits = searchCatalogTeams("chiefs");
    expect(
      hits.some(
        (t) =>
          t.name === "Kansas City Chiefs" && t.leagueKey === "football/nfl",
      ),
    ).toBe(true);
  });

  it("'yankees' finds a Baseball team in baseball/mlb", () => {
    const hits = searchCatalogTeams("yankees");
    expect(
      hits.some(
        (t) => t.sport === "Baseball" && t.leagueKey === "baseball/mlb",
      ),
    ).toBe(true);
  });

  it("sport filter narrows results (Soccer 'arsenal' excludes any college-football 'Arsenal')", () => {
    const hits = searchCatalogTeams("arsenal", "Soccer");
    for (const t of hits) expect(t.sport).toBe("Soccer");
  });

  it("case-insensitive match", () => {
    const a = searchCatalogTeams("ARSENAL");
    const b = searchCatalogTeams("arsenal");
    expect(a).toEqual(b);
  });
});

describe("searchCatalogLeagues", () => {
  it("'premier' finds the Premier League", () => {
    const hits = searchCatalogLeagues("premier");
    expect(hits.some((l) => l.id === "soccer/eng.1")).toBe(true);
  });

  it("'NBA' finds basketball/nba", () => {
    const hits = searchCatalogLeagues("NBA");
    expect(hits.some((l) => l.id === "basketball/nba")).toBe(true);
  });

  it("sport filter narrows results", () => {
    const hits = searchCatalogLeagues("league", "Soccer");
    for (const l of hits) expect(l.sport).toBe("Soccer");
  });

  it("'wimbledon' returns the Wimbledon entry with id=tennis/slam/wimbledon and sport=Tennis", () => {
    const hits = searchCatalogLeagues("wimbledon");
    const wimbledon = hits.find((l) => l.id === "tennis/slam/wimbledon");
    expect(wimbledon).toBeDefined();
    expect(wimbledon!.sport).toBe("Tennis");
  });

  it("catalog contains exactly 23 Tennis league entries", () => {
    const tennis = ALL_CATALOG_LEAGUES.filter((l) => l.sport === "Tennis");
    expect(tennis).toHaveLength(23);
  });

  it("catalog sport set includes Tennis alongside the four team sports", () => {
    const sports = new Set(ALL_CATALOG_LEAGUES.map((l) => l.sport));
    expect(sports).toContain("Tennis");
    expect(sports).toContain("Soccer");
    expect(sports).toContain("Basketball");
  });
});
