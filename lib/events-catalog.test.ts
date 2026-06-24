import { describe, expect, it } from "vitest";
import {
  EVENTS_CATALOG,
  enrichMatchWithEventInstance,
  findEventInstanceForMatch,
} from "./events-catalog";
import type { Match } from "@/lib/sports/types";

function makeMatch(over: Partial<Match>): Match {
  return {
    id: "evt",
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: "Home",
    awayTeamId: "a",
    awayTeamName: "Away",
    leagueId: "soccer/eng.1",
    leagueName: "English Premier League",
    dateUtc: "2026-06-24",
    kickoffUtc: null,
    status: "upcoming",
    ...over,
  };
}

describe("events catalog enrichment", () => {
  it("tags a soccer match in soccer/fifa.world within the World Cup 2026 window", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/fifa.world",
      leagueName: "FIFA World Cup",
      dateUtc: "2026-06-24",
    });
    const e = findEventInstanceForMatch(m);
    expect(e?.id).toBe("fifa-world-cup-2026");
  });

  it("does not tag a soccer match in soccer/fifa.world OUTSIDE the World Cup window", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/fifa.world",
      leagueName: "FIFA World Cup",
      dateUtc: "2025-12-01",
    });
    expect(findEventInstanceForMatch(m)).toBeNull();
  });

  it("tags the Super Bowl by leagueId + leagueNameContains (NFL parent league + name disambiguation)", () => {
    const m = makeMatch({
      sport: "American Football",
      leagueId: "football/nfl",
      leagueName: "NFL Super Bowl LX",
      dateUtc: "2026-02-08",
    });
    const e = findEventInstanceForMatch(m);
    expect(e?.id).toBe("nfl-super-bowl-lx");
  });

  it("does NOT tag a regular-season NFL game as Super Bowl (no name match)", () => {
    const m = makeMatch({
      sport: "American Football",
      leagueId: "football/nfl",
      leagueName: "National Football League",
      dateUtc: "2026-02-08",
    });
    expect(findEventInstanceForMatch(m)).toBeNull();
  });

  it("tags a UEFA Euro 2028 match by leagueNameContains fallback (no league key set)", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/whatever",
      leagueName: "UEFA Euro 2028 — Group A",
      dateUtc: "2028-06-15",
    });
    const e = findEventInstanceForMatch(m);
    expect(e?.id).toBe("uefa-euro-2028");
  });

  it("does not cross sports (a basketball match in a soccer-tagged window stays null)", () => {
    const m = makeMatch({
      sport: "Basketball",
      leagueId: "soccer/fifa.world",
      leagueName: "FIFA World Cup",
      dateUtc: "2026-06-24",
    });
    expect(findEventInstanceForMatch(m)).toBeNull();
  });

  it("enrichMatchWithEventInstance populates eventInstanceId when claimed", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/fifa.world",
      leagueName: "FIFA World Cup",
      dateUtc: "2026-06-24",
    });
    const enriched = enrichMatchWithEventInstance(m);
    expect(enriched.eventInstanceId).toBe("fifa-world-cup-2026");
  });

  it("enrichMatchWithEventInstance preserves a pre-set eventInstanceId", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/fifa.world",
      leagueName: "FIFA World Cup",
      dateUtc: "2026-06-24",
      eventInstanceId: "already-set",
    });
    const enriched = enrichMatchWithEventInstance(m);
    expect(enriched.eventInstanceId).toBe("already-set");
  });

  it("returns the unmodified match when no catalog entry claims it", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "soccer/eng.1",
      leagueName: "English Premier League",
      dateUtc: "2026-06-24",
    });
    expect(enrichMatchWithEventInstance(m)).toBe(m);
  });

  it("every catalog entry has either a leagueId or a leagueNameContains", () => {
    for (const e of EVENTS_CATALOG) {
      expect(Boolean(e.leagueId) || Boolean(e.leagueNameContains)).toBe(true);
    }
  });

  it("no catalog entries reference Tennis", () => {
    for (const e of EVENTS_CATALOG) {
      expect((e.sport as string) === "Tennis").toBe(false);
    }
  });
});
