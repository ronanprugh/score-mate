import { describe, expect, it } from "vitest";
import {
  getActiveTennisTournaments,
  type TennisScoreboardFetcher,
} from "./tennis-aggregator";
import type { Match } from "@/lib/sports/types";
import { MARQUEE_TENNIS_TOURNAMENTS } from "@/lib/espn/tennis";

const TODAY = "2025-06-02";

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
        return [makeMatch({ id: `${id}-m1`, status: "upcoming" })];
      }
      return [];
    };

    const result = await getActiveTennisTournaments(TODAY, fetcher);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id).sort()).toEqual([...withMatches].sort());
    // IDs not in withMatches must not appear
    for (const t of result) {
      expect(withMatches.has(t.id)).toBe(true);
    }
    // The overall registry has 23 entries; only 3 should be active
    expect(tournamentIds).toHaveLength(23);
  });

  it("computes liveCount, upcomingCount, doneCount from status", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/roland-garros") {
        return [SLAM_LIVE, SLAM_UPCOMING, SLAM_FINAL];
      }
      return [];
    };

    const result = await getActiveTennisTournaments(TODAY, fetcher);
    expect(result).toHaveLength(1);
    const t = result[0]!;
    expect(t.liveCount).toBe(1);
    expect(t.upcomingCount).toBe(1);
    expect(t.doneCount).toBe(1);
  });

  it("derives currentRound from the round field of the first match", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/wimbledon") {
        return [
          makeMatch({ id: "w1", status: "live", round: "Semifinals" }),
          makeMatch({ id: "w2", status: "upcoming", round: "Semifinals" }),
        ];
      }
      return [];
    };

    const result = await getActiveTennisTournaments(TODAY, fetcher);
    expect(result[0]?.currentRound).toBe("Semifinals");
  });

  it("derives startDate and endDate from min/max dateUtc across matches", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/us-open") {
        return [
          makeMatch({ id: "u1", status: "final", dateUtc: "2025-09-01" }),
          makeMatch({ id: "u2", status: "upcoming", dateUtc: "2025-09-03" }),
          makeMatch({ id: "u3", status: "live", dateUtc: "2025-09-02" }),
        ];
      }
      return [];
    };

    const result = await getActiveTennisTournaments("2025-09-02", fetcher);
    const t = result[0]!;
    expect(t.startDate).toBe("2025-09-01");
    expect(t.endDate).toBe("2025-09-03");
  });

  it("drops tournaments whose fetcher call rejects", async () => {
    const fetcher: TennisScoreboardFetcher = async (id) => {
      if (id === "tennis/slam/australian-open") {
        throw new Error("ESPN 503");
      }
      if (id === "tennis/atp/indian-wells") {
        return [makeMatch({ id: "iw1", status: "upcoming" })];
      }
      return [];
    };

    const result = await getActiveTennisTournaments(TODAY, fetcher);
    expect(result.map((t) => t.id)).toEqual(["tennis/atp/indian-wells"]);
  });
});
