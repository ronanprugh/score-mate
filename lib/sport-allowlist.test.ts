import { describe, expect, it } from "vitest";
import { matchesSportAllowlist, SPORT_ALLOWLIST } from "./sport-allowlist";
import type { Match, Sport } from "./sports/types";

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: "test-event-1",
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: "Home",
    awayTeamId: "a",
    awayTeamName: "Away",
    leagueId: "soccer/eng.1",
    leagueName: "English Premier League",
    dateUtc: "2026-06-22",
    kickoffUtc: "2026-06-22T15:00:00",
    status: "upcoming",
    ...overrides,
  };
}

describe("SPORT_ALLOWLIST shape", () => {
  it("has at least one entry for each supported sport", () => {
    const sports: Sport[] = ["Soccer", "American Football", "Basketball"];
    for (const s of sports) {
      expect(SPORT_ALLOWLIST[s].length).toBeGreaterThan(0);
    }
  });

  it("every entry has either a leagueId or a leagueNameContains", () => {
    for (const entries of Object.values(SPORT_ALLOWLIST)) {
      for (const e of entries) {
        expect(Boolean(e.leagueId || e.leagueNameContains)).toBe(true);
        expect(e.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("contains no Tennis allowlist", () => {
    expect((SPORT_ALLOWLIST as Record<string, unknown>).Tennis).toBeUndefined();
  });
});

describe("matchesSportAllowlist", () => {
  it("rejects matches whose sport doesn't match the requested sport", () => {
    const basketballMatch = makeMatch({
      sport: "Basketball",
      leagueId: "basketball/nba",
    });
    expect(matchesSportAllowlist("Soccer", basketballMatch)).toBe(false);
  });

  /* ---------- Soccer ---------- */
  it("Soccer: accepts a Premier League match (by leagueId)", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/eng.1",
      leagueName: "English Premier League",
    });
    expect(matchesSportAllowlist("Soccer", m)).toBe(true);
  });

  it("Soccer: accepts a UEFA Euro match (by name substring)", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/uefa.euro",
      leagueName: "UEFA Euro 2028 Qualification",
    });
    expect(matchesSportAllowlist("Soccer", m)).toBe(true);
  });

  it("Soccer: REJECTS a Championship match (not on the allowlist)", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/eng.2",
      leagueName: "English League Championship",
    });
    expect(matchesSportAllowlist("Soccer", m)).toBe(false);
  });

  /* ---------- American Football ---------- */
  it("American Football: accepts an NFL match (by leagueId)", () => {
    const m = makeMatch({
      sport: "American Football",
      leagueId: "football/nfl",
      leagueName: "NFL",
    });
    expect(matchesSportAllowlist("American Football", m)).toBe(true);
  });

  it("American Football: rejects an XFL match", () => {
    const m = makeMatch({
      sport: "American Football",
      leagueId: "football/xfl",
      leagueName: "XFL",
    });
    expect(matchesSportAllowlist("American Football", m)).toBe(false);
  });

  /* ---------- Basketball ---------- */
  it("Basketball: accepts an NBA match (by leagueId)", () => {
    const m = makeMatch({
      sport: "Basketball",
      leagueId: "basketball/nba",
      leagueName: "NBA",
    });
    expect(matchesSportAllowlist("Basketball", m)).toBe(true);
  });

  it("Basketball: rejects an EuroLeague match", () => {
    const m = makeMatch({
      sport: "Basketball",
      leagueId: "basketball/euroleague",
      leagueName: "EuroLeague",
    });
    expect(matchesSportAllowlist("Basketball", m)).toBe(false);
  });
});
