import { describe, expect, it } from "vitest";
import {
  EVENTS_CATALOG,
  enrichMatchWithEventInstance,
  findEventInstanceForMatch,
} from "./events-catalog";
import type { Match } from "@/lib/sportsdb/types";

function makeMatch(over: Partial<Match>): Match {
  return {
    id: "evt",
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: "Home",
    awayTeamId: "a",
    awayTeamName: "Away",
    leagueId: "9999",
    leagueName: "Some League",
    dateUtc: "2026-06-24",
    kickoffUtc: null,
    status: "upcoming",
    ...over,
  };
}

describe("events catalog enrichment", () => {
  it("tags a soccer match in league 4429 within the World Cup 2026 window", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "4429",
      leagueName: "FIFA World Cup",
      dateUtc: "2026-06-24",
    });
    const e = findEventInstanceForMatch(m);
    expect(e?.id).toBe("fifa-world-cup-2026");
  });

  it("does not tag a soccer match in league 4429 OUTSIDE the World Cup window", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "4429",
      leagueName: "FIFA World Cup",
      dateUtc: "2025-12-01",
    });
    expect(findEventInstanceForMatch(m)).toBeNull();
  });

  it("tags a Wimbledon match by leagueNameContains fallback", () => {
    const m = makeMatch({
      sport: "Tennis",
      leagueId: "irrelevant",
      leagueName: "Wimbledon 2026 — Men's Singles",
      dateUtc: "2026-07-01",
    });
    const e = findEventInstanceForMatch(m);
    expect(e?.id).toBe("wimbledon-2026");
  });

  it("does not cross sports (a basketball match in a soccer-tagged window stays null)", () => {
    const m = makeMatch({
      sport: "Basketball",
      leagueId: "4429",
      leagueName: "FIFA World Cup",
      dateUtc: "2026-06-24",
    });
    expect(findEventInstanceForMatch(m)).toBeNull();
  });

  it("enrichMatchWithEventInstance populates eventInstanceId when claimed", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "4429",
      leagueName: "FIFA World Cup",
      dateUtc: "2026-06-24",
    });
    const enriched = enrichMatchWithEventInstance(m);
    expect(enriched.eventInstanceId).toBe("fifa-world-cup-2026");
  });

  it("enrichMatchWithEventInstance preserves a pre-set eventInstanceId", () => {
    const m = makeMatch({
      sport: "Soccer",
      leagueId: "4429",
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
      leagueId: "4328",
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
});
