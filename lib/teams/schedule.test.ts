import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/sports/types";
import {
  selectLastAndNext,
  splitAndCapSchedule,
  teamScheduleAcrossCompetitions,
} from "./schedule";

const LIVERPOOL = "364";

/** Minimal `Match` builder — only the fields these selectors read. */
function match(over: Partial<Match> & Pick<Match, "id">): Match {
  return {
    sport: "Soccer",
    homeTeamId: LIVERPOOL,
    homeTeamName: "Liverpool",
    awayTeamId: "999",
    awayTeamName: "Opponent",
    leagueId: "soccer/eng.1",
    leagueName: "Premier League",
    dateUtc: "2026-05-24",
    kickoffUtc: "2026-05-24T15:00Z",
    status: "final",
    ...over,
  } as Match;
}

describe("teamScheduleAcrossCompetitions — fan-out (Spec 13, Unit 2)", () => {
  it("merges matches from the primary league and every companion", async () => {
    const byLeague: Record<string, Match[]> = {
      "soccer/eng.1": [match({ id: "league-1" })],
      "soccer/club.friendly": [
        match({ id: "friendly-1", leagueName: "Club Friendly" }),
      ],
      "soccer/uefa.champions": [
        match({ id: "ucl-1", leagueName: "UEFA Champions League" }),
      ],
    };

    const { matches, errors } = await teamScheduleAcrossCompetitions(
      "soccer/eng.1",
      LIVERPOOL,
      { fetchLeagueSchedule: async (key) => byLeague[key] ?? [] },
    );

    expect(matches.map((m) => m.id).sort()).toEqual([
      "friendly-1",
      "league-1",
      "ucl-1",
    ]);
    expect(errors).toEqual([]);
  });

  it("requests the primary league plus its six companions for a PL team", async () => {
    const requested: string[] = [];
    await teamScheduleAcrossCompetitions("soccer/eng.1", LIVERPOOL, {
      fetchLeagueSchedule: async (key) => {
        requested.push(key);
        return [];
      },
    });

    expect(requested).toHaveLength(7);
    expect(requested[0]).toBe("soccer/eng.1");
    expect(requested).toContain("soccer/club.friendly");
    expect(requested).toContain("soccer/uefa.champions");
  });

  it("requests only the primary league for a single-competition sport", async () => {
    const requested: string[] = [];
    await teamScheduleAcrossCompetitions("football/nfl", "12", {
      fetchLeagueSchedule: async (key) => {
        requested.push(key);
        return [];
      },
    });

    expect(requested).toEqual(["football/nfl"]);
  });

  it("dedupes a fixture that appears under more than one league key", async () => {
    const shared = match({ id: "shared-tie" });
    const { matches } = await teamScheduleAcrossCompetitions(
      "soccer/eng.1",
      LIVERPOOL,
      { fetchLeagueSchedule: async () => [shared] },
    );

    // All 7 leagues returned the same fixture; it must appear exactly once.
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("shared-tie");
  });

  it("issues every league request concurrently", async () => {
    // The latency budget assumes fan-out width costs ~nothing on the warm
    // path. Sequential requests would make cold latency scale with league
    // count instead of staying near the slowest single call.
    let inFlight = 0;
    let maxInFlight = 0;

    await teamScheduleAcrossCompetitions("soccer/eng.1", LIVERPOOL, {
      fetchLeagueSchedule: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return [];
      },
    });

    expect(maxInFlight).toBe(7);
  });

  it("records an error but keeps the other competitions when one league fails", async () => {
    const { matches, errors } = await teamScheduleAcrossCompetitions(
      "soccer/eng.1",
      LIVERPOOL,
      {
        fetchLeagueSchedule: async (key) => {
          if (key === "soccer/uefa.europa") {
            throw new Error("ESPN 503 Service Unavailable");
          }
          return key === "soccer/eng.1" ? [match({ id: "league-1" })] : [];
        },
      },
    );

    expect(matches.map((m) => m.id)).toEqual(["league-1"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("soccer/uefa.europa");
    expect(errors[0]).toContain("503");
  });

  it("treats an empty companion league as normal, not an error", async () => {
    // A team not competing in the Europa League returns zero events. That
    // must not flip source.ok or raise an error banner.
    const { matches, errors } = await teamScheduleAcrossCompetitions(
      "soccer/eng.1",
      LIVERPOOL,
      {
        fetchLeagueSchedule: async (key) =>
          key === "soccer/eng.1" ? [match({ id: "league-1" })] : [],
      },
    );

    expect(matches).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it("returns no matches and every error when all leagues fail", async () => {
    const { matches, errors } = await teamScheduleAcrossCompetitions(
      "soccer/eng.1",
      LIVERPOOL,
      {
        fetchLeagueSchedule: async () => {
          throw new Error("network down");
        },
      },
    );

    expect(matches).toEqual([]);
    expect(errors).toHaveLength(7);
  });
});

describe("selectLastAndNext — cross-competition selection", () => {
  it("picks the chronologically most recent completed match across competitions", () => {
    const { lastMatch } = selectLastAndNext([
      match({ id: "league", kickoffUtc: "2026-05-24T15:00Z" }),
      match({
        id: "ucl",
        kickoffUtc: "2026-04-14T19:00Z",
        leagueName: "UEFA Champions League",
      }),
    ]);

    expect(lastMatch?.id).toBe("league");
  });

  it("selects a friendly over an older league fixture — no preference for competitive matches", () => {
    // Preseason: the friendly IS the news. Spec 13 Unit 2 / Q6 answer (A).
    const { lastMatch } = selectLastAndNext([
      match({ id: "league-final", kickoffUtc: "2026-05-24T15:00Z" }),
      match({
        id: "friendly-leeds",
        kickoffUtc: "2026-08-02T20:00Z",
        leagueName: "Club Friendly",
      }),
    ]);

    expect(lastMatch?.id).toBe("friendly-leeds");
    expect(lastMatch?.leagueName).toBe("Club Friendly");
  });

  it("picks the soonest upcoming match across competitions", () => {
    const { nextMatch } = selectLastAndNext([
      match({
        id: "later",
        status: "upcoming",
        kickoffUtc: "2026-09-01T15:00Z",
      }),
      match({
        id: "sooner",
        status: "upcoming",
        kickoffUtc: "2026-08-15T19:00Z",
      }),
    ]);

    expect(nextMatch?.id).toBe("sooner");
  });

  it("returns nulls for an empty schedule", () => {
    expect(selectLastAndNext([])).toEqual({
      lastMatch: null,
      nextMatch: null,
    });
  });

  it("ignores live matches for both sides", () => {
    const { lastMatch, nextMatch } = selectLastAndNext([
      match({ id: "live", status: "live" }),
    ]);

    expect(lastMatch).toBeNull();
    expect(nextMatch).toBeNull();
  });

  it("falls back to dateUtc when kickoffUtc is unknown", () => {
    const { lastMatch } = selectLastAndNext([
      match({ id: "dated", kickoffUtc: null, dateUtc: "2026-06-01" }),
      match({ id: "older", kickoffUtc: null, dateUtc: "2026-05-01" }),
    ]);

    expect(lastMatch?.id).toBe("dated");
  });

  it("agrees with splitAndCapSchedule about which match is most recent", () => {
    // The two selectors share a sort key; this pins that they cannot drift.
    const schedule = [
      match({ id: "a", kickoffUtc: "2026-05-01T15:00Z" }),
      match({ id: "b", kickoffUtc: "2026-08-02T20:00Z" }),
      match({
        id: "c",
        status: "upcoming",
        kickoffUtc: "2026-08-15T19:00Z",
      }),
    ];

    const { lastMatch, nextMatch } = selectLastAndNext(schedule);
    const { recent, upcoming } = splitAndCapSchedule(schedule);

    expect(lastMatch?.id).toBe(recent[0]?.id);
    expect(nextMatch?.id).toBe(upcoming[0]?.id);
  });
});
