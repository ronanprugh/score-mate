import { describe, expect, it } from "vitest";
import { matchesSportAllowlist, SPORT_ALLOWLIST } from "./sport-allowlist";
import type { Match, Sport } from "./sportsdb/types";

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: "test-event-1",
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: "Home",
    awayTeamId: "a",
    awayTeamName: "Away",
    leagueId: "0000",
    leagueName: "Some League",
    dateUtc: "2026-06-22",
    kickoffUtc: "2026-06-22T15:00:00",
    status: "upcoming",
    ...overrides,
  };
}

describe("SPORT_ALLOWLIST shape", () => {
  it("has at least one entry for each supported sport", () => {
    const sports: Sport[] = [
      "Soccer",
      "American Football",
      "Basketball",
      "Tennis",
    ];
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
});

describe("matchesSportAllowlist", () => {
  it("rejects matches whose sport doesn't match the requested sport", () => {
    const basketballMatch = makeMatch({
      sport: "Basketball",
      leagueId: "4387",
    });
    expect(matchesSportAllowlist("Soccer", basketballMatch)).toBe(false);
  });

  /* ---------- Soccer ---------- */
  it("Soccer: accepts a Premier League match (by leagueId)", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "4328",
      leagueName: "English Premier League",
    });
    expect(matchesSportAllowlist("Soccer", m)).toBe(true);
  });

  it("Soccer: accepts a UEFA Euro match (by name substring)", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "0001",
      leagueName: "UEFA Euro 2028 Qualification",
    });
    expect(matchesSportAllowlist("Soccer", m)).toBe(true);
  });

  it("Soccer: REJECTS a Championship match (not on the allowlist)", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "4396",
      leagueName: "English League Championship",
    });
    expect(matchesSportAllowlist("Soccer", m)).toBe(false);
  });

  /* ---------- American Football ---------- */
  it("American Football: accepts an NFL match (by leagueId)", () => {
    const m = makeMatch({
      sport: "American Football",
      leagueId: "4391",
      leagueName: "NFL",
    });
    expect(matchesSportAllowlist("American Football", m)).toBe(true);
  });

  it("American Football: rejects an XFL match", () => {
    const m = makeMatch({
      sport: "American Football",
      leagueId: "9999",
      leagueName: "XFL",
    });
    expect(matchesSportAllowlist("American Football", m)).toBe(false);
  });

  /* ---------- Basketball ---------- */
  it("Basketball: accepts an NBA match (by leagueId)", () => {
    const m = makeMatch({
      sport: "Basketball",
      leagueId: "4387",
      leagueName: "NBA",
    });
    expect(matchesSportAllowlist("Basketball", m)).toBe(true);
  });

  it("Basketball: rejects an EuroLeague match", () => {
    const m = makeMatch({
      sport: "Basketball",
      leagueId: "9998",
      leagueName: "EuroLeague",
    });
    expect(matchesSportAllowlist("Basketball", m)).toBe(false);
  });

  /* ---------- Tennis ---------- */
  it("Tennis: accepts a Wimbledon match (by name substring)", () => {
    const m = makeMatch({
      sport: "Tennis",
      leagueId: "4464",
      leagueName: "ATP Wimbledon",
    });
    expect(matchesSportAllowlist("Tennis", m)).toBe(true);
  });

  it("Tennis: rejects an ATP 250 event (not on the allowlist)", () => {
    const m = makeMatch({
      sport: "Tennis",
      leagueId: "9997",
      leagueName: "ATP 250 Adelaide",
    });
    expect(matchesSportAllowlist("Tennis", m)).toBe(false);
  });
});
