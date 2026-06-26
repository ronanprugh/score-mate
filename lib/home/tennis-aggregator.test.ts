import { describe, expect, it } from "vitest";
import {
  getActiveTennisTournaments,
  type TennisScoreboardFetcher,
} from "./tennis-aggregator";
import type { Match } from "@/lib/sports/types";
import type { TennisScoreboardResult } from "@/lib/espn/tennis";
import { MARQUEE_TENNIS_TOURNAMENTS } from "@/lib/espn/tennis";

const TODAY = "2025-06-02";

/** Wraps matches (and an optional draw span) into a scoreboard result. */
function result(
  matches: Match[],
  span?: { start: string; end: string },
): TennisScoreboardResult {
  return {
    matches,
    eventStartDate: span?.start,
    eventEndDate: span?.end,
  };
}

function makeMatch(
  overrides: Partial<Match> & Pick<Match, "id" | "status">,
): Match {
  return {
    sport: "Tennis",
    homeTeamId: "player-1",
    homeTeamName: "Rafael Nadal",
    awayTeamId: "player-2",
    awayTeamName: "Carlos Alcaraz",
    leagueId: "tennis/slam/roland-garros",
    leagueName: "Roland Garros",
    dateUtc: TODAY,
    kickoffUtc: `${TODAY}T10:00:00Z`,
    round: "Quarterfinals",
    ...overrides,
  };
}

const SLAM_LIVE = makeMatch({ id: "m1", status: "live" });
const SLAM_UPCOMING = makeMatch({ id: "m2", status: "upcoming" });
const SLAM_FINAL = makeMatch({
  id: "m3",
  status: "final",
  homeScore: 3,
  awayScore: 1,
});

describe("getActiveTennisTournaments", () => {
  it("only returns tournaments whose fetcher returns ≥1 match", async () => {
    // 3 with matches, 2 returning []
    const tournamentIds = MARQUEE_TENNIS_TOURNAMENTS.map((t) => t.id);
    const withMatches = new Set([
      "tennis/slam/roland-garros",
      "tennis/atp/miami",
      "tennis/wta/rome",
    ]);
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (withMatches.has(id)) {
        return result([makeMatch({ id: `${id}-m1`, status: "upcoming" })]);
      }
      return result([]);
    };

    const active = await getActiveTennisTournaments(TODAY, fetcher);
    expect(active).toHaveLength(3);
    expect(active.map((t) => t.id).sort()).toEqual([...withMatches].sort());
    // IDs not in withMatches must not appear
    for (const t of active) {
      expect(withMatches.has(t.id)).toBe(true);
    }
    // The overall registry has 23 entries; only 3 should be active
    expect(tournamentIds).toHaveLength(23);
  });

  it("computes liveCount, upcomingCount, doneCount from status", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/roland-garros") {
        return result([SLAM_LIVE, SLAM_UPCOMING, SLAM_FINAL]);
      }
      return result([]);
    };

    const active = await getActiveTennisTournaments(TODAY, fetcher);
    expect(active).toHaveLength(1);
    const t = active[0]!;
    expect(t.liveCount).toBe(1);
    expect(t.upcomingCount).toBe(1);
    expect(t.doneCount).toBe(1);
  });

  it("prefers the real round (tennis.round) over the draw name for currentRound", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/wimbledon") {
        return result([
          // `round` carries the draw/grouping name; `tennis.round` carries the
          // real round and must win.
          makeMatch({
            id: "w1",
            status: "live",
            round: "Men's Singles",
            tennis: {
              draw: "Men's Singles",
              round: "Quarterfinals",
              home: { sets: [], won: false },
              away: { sets: [], won: false },
            },
          }),
        ]);
      }
      return result([]);
    };

    const active = await getActiveTennisTournaments(TODAY, fetcher);
    expect(active[0]?.currentRound).toBe("Quarterfinals");
  });

  it("uses the tournament's overall draw span for startDate/endDate, not the day's matches", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/us-open") {
        // Only one day's match is returned, but the draw span covers the run.
        return result(
          [makeMatch({ id: "u1", status: "live", dateUtc: "2025-09-02" })],
          {
            start: "2025-08-25",
            end: "2025-09-07",
          },
        );
      }
      return result([]);
    };

    const active = await getActiveTennisTournaments("2025-09-02", fetcher);
    const t = active[0]!;
    expect(t.startDate).toBe("2025-08-25");
    expect(t.endDate).toBe("2025-09-07");
  });

  it("falls back to the day's match dates when no draw span is provided", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/atp/rome") {
        return result([
          makeMatch({ id: "r1", status: "final", dateUtc: "2025-06-02" }),
        ]);
      }
      return result([]);
    };

    const active = await getActiveTennisTournaments(TODAY, fetcher);
    expect(active[0]?.startDate).toBe("2025-06-02");
    expect(active[0]?.endDate).toBe("2025-06-02");
  });

  it("drops tournaments whose fetcher call rejects", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/australian-open") {
        throw new Error("ESPN 503");
      }
      if (id === "tennis/atp/indian-wells") {
        return result([makeMatch({ id: "iw1", status: "upcoming" })]);
      }
      return result([]);
    };

    const active = await getActiveTennisTournaments(TODAY, fetcher);
    expect(active.map((t) => t.id)).toEqual(["tennis/atp/indian-wells"]);
  });
});
