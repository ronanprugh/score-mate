import { describe, expect, it } from "vitest";
import {
  ALL_CATALOG_LEAGUES,
  ALL_CATALOG_TEAMS,
  searchCatalogLeagues,
  searchCatalogTeams,
} from "./catalog";

describe("ESPN catalog shape", () => {
  it("ships ≥ 500 teams across the supported leagues", () => {
    expect(ALL_CATALOG_TEAMS.length).toBeGreaterThanOrEqual(500);
  });

  it("only contains the three v1 sports (no Tennis, no Hockey)", () => {
    const sports = new Set(ALL_CATALOG_TEAMS.map((t) => t.sport));
    expect(sports).toEqual(
      new Set(["American Football", "Basketball", "Soccer"]),
    );
  });

  it("league count matches the v1 registry (2 + 3 + 14 = 19)", () => {
    expect(ALL_CATALOG_LEAGUES).toHaveLength(19);
  });

  it("every team carries a leagueKey using the {sport}/{league} ESPN shape", () => {
    for (const t of ALL_CATALOG_TEAMS) {
      expect(t.leagueKey).toMatch(/^(football|basketball|soccer)\//);
    }
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
});
