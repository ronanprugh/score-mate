import { describe, expect, it } from "vitest";
import nflScoreboard from "./__fixtures__/nfl-scoreboard.json" with { type: "json" };
import nbaScoreboard from "./__fixtures__/nba-scoreboard.json" with { type: "json" };
import eplScoreboard from "./__fixtures__/epl-scoreboard.json" with { type: "json" };
import emptyScoreboard from "./__fixtures__/empty-scoreboard.json" with { type: "json" };
import nflTeams from "./__fixtures__/nfl-teams.json" with { type: "json" };

import {
  athleteSchedule,
  buildLeagueTeamsUrl,
  buildScoreboardUrl,
  buildTeamScheduleUrl,
  fetchEventCoreDetail,
  leagueTeams,
  scoreboardForLeague,
  searchAthletes,
  sportFromLeagueKey,
} from "./client";

/** A fetchFn that returns different JSON bodies keyed by a URL substring. */
function routedFetch(routes: Record<string, unknown>): typeof fetch {
  return async (url: Parameters<typeof fetch>[0]) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    return new Response(JSON.stringify(key ? routes[key] : {}), {
      status: key ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function mockJsonFetch(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  return async () =>
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
}

describe("ESPN URL builders", () => {
  it("scoreboard URL strips hyphens from date and uses site v2 base", () => {
    expect(buildScoreboardUrl("football/nfl", "2026-01-15")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20260115",
    );
  });

  it("league teams URL targets per-league teams endpoint with limit", () => {
    expect(buildLeagueTeamsUrl("basketball/nba")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=1000",
    );
  });

  it("team schedule URL encodes the team id", () => {
    expect(buildTeamScheduleUrl("soccer/eng.1", "359")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/359/schedule",
    );
  });
});

describe("searchAthletes — global player search", () => {
  const payload = {
    items: [
      {
        id: 1966,
        sport: "basketball",
        league: "nba",
        displayName: "LeBron James",
      },
      { id: 3626, sport: "tennis", league: "wta", displayName: "Coco Gauff" },
      // Unsupported sport → dropped.
      { id: 999, sport: "mma", league: null, displayName: "Some Fighter" },
      // Missing league → dropped.
      { id: 888, sport: "basketball", league: null, displayName: "No League" },
    ],
  };

  it("maps items to {id, displayName, sport, leagueKey}, dropping unsupported/incomplete", async () => {
    const results = await searchAthletes("x", {
      fetchFn: mockJsonFetch(payload),
    });
    expect(results).toEqual([
      {
        id: "1966",
        displayName: "LeBron James",
        sport: "Basketball",
        leagueKey: "basketball/nba",
      },
      {
        id: "3626",
        displayName: "Coco Gauff",
        sport: "Tennis",
        leagueKey: "tennis/wta",
      },
    ]);
  });

  it("returns [] on a fetch error (never throws)", async () => {
    const results = await searchAthletes("x", {
      fetchFn: async () => {
        throw new Error("network");
      },
    });
    expect(results).toEqual([]);
  });
});

describe("athleteSchedule — team vs individual (tennis) eventlogs", () => {
  const DAY = 86_400_000;
  const past = (days: number) =>
    new Date(Date.now() - days * DAY).toISOString();
  const future = (days: number) =>
    new Date(Date.now() + days * DAY).toISOString();

  it("team sport: picks latest-completed + earliest-upcoming by date, with W/L", async () => {
    const fetchFn = routedFetch({
      "/athletes/1966/eventlog": {
        events: {
          items: [
            // Deliberately NOT in date order (the real API isn't either).
            { teamId: "13", event: { $ref: "http://x/events/future" } },
            { teamId: "13", event: { $ref: "http://x/events/old" } },
            { teamId: "13", event: { $ref: "http://x/events/recent" } },
          ],
        },
      },
      "/events/old": {
        date: past(30),
        name: "Phoenix Suns at Los Angeles Lakers",
        competitions: [{ competitors: [{ id: "13", homeAway: "home" }] }],
      },
      "/events/recent": {
        date: past(2),
        name: "Utah Jazz at Los Angeles Lakers",
        competitions: [
          { competitors: [{ id: "13", homeAway: "home", winner: true }] },
        ],
      },
      "/events/future": {
        date: future(3),
        name: "Los Angeles Lakers at Boston Celtics",
        competitions: [{ competitors: [{ id: "13", homeAway: "away" }] }],
      },
    });

    const { lastMatch, nextMatch } = await athleteSchedule(
      "basketball/nba",
      "1966",
      { fetchFn },
    );
    // Most recent completed = the 2-days-ago Jazz game (a win), not the 30d one.
    expect(lastMatch?.opponentName).toBe("Utah Jazz");
    expect(lastMatch?.result).toBe("W");
    // Earliest upcoming = the future Celtics game (no result).
    expect(nextMatch?.opponentName).toBe("Boston Celtics");
    expect(nextMatch?.result).toBeUndefined();
  });

  it("tennis: opponent from the competition (not the tournament) + set score + result", async () => {
    const fetchFn = routedFetch({
      "/athletes/3623/eventlog": {
        events: {
          items: [
            {
              event: { $ref: "http://x/events/wimbledon" },
              competition: { $ref: "http://x/competitions/last" },
            },
            {
              event: { $ref: "http://x/events/wimbledon" },
              competition: { $ref: "http://x/competitions/next" },
            },
          ],
        },
      },
      "/competitions/last": {
        date: past(1),
        competitors: [
          {
            id: "3623-1",
            name: "Jannik Sinner",
            winner: true,
            linescores: { $ref: "http://x/ls/mine" },
          },
          {
            id: "9999-2",
            name: "Jan-Lennard Struff",
            winner: false,
            linescores: { $ref: "http://x/ls/opp" },
          },
        ],
      },
      "/ls/mine": { items: [{ value: 7 }, { value: 7 }, { value: 6 }] },
      "/ls/opp": { items: [{ value: 5 }, { value: 6 }, { value: 3 }] },
      "/competitions/next": {
        date: future(2),
        competitors: [
          { id: "3623-1", name: "Jannik Sinner" },
          { id: "1234-3", name: "Novak Djokovic" },
        ],
      },
    });

    const { lastMatch, nextMatch } = await athleteSchedule(
      "tennis/atp",
      "3623",
      {
        fetchFn,
      },
    );
    expect(lastMatch?.opponentName).toBe("Jan-Lennard Struff");
    expect(lastMatch?.score).toBe("7-5, 7-6, 6-3");
    expect(lastMatch?.result).toBe("W");
    expect(nextMatch?.opponentName).toBe("Novak Djokovic");
    expect(nextMatch?.score).toBeUndefined();
  });

  it("returns nulls (never throws) when the eventlog fetch fails", async () => {
    const { lastMatch, nextMatch } = await athleteSchedule(
      "tennis/wta",
      "3626",
      {
        fetchFn: async () => {
          throw new Error("boom");
        },
      },
    );
    expect(lastMatch).toBeNull();
    expect(nextMatch).toBeNull();
  });
});

describe("sportFromLeagueKey", () => {
  it.each([
    ["football/nfl", "American Football"],
    ["football/college-football", "American Football"],
    ["basketball/nba", "Basketball"],
    ["basketball/wnba", "Basketball"],
    ["soccer/eng.1", "Soccer"],
    ["soccer/fifa.world", "Soccer"],
    ["baseball/mlb", "Baseball"],
    ["baseball/college-baseball", "Baseball"],
    ["tennis/atp/wimbledon", "Tennis"],
    ["tennis/wta/wimbledon", "Tennis"],
    ["tennis/slam/wimbledon", "Tennis"],
  ])("%s -> %s", (key, expected) => {
    expect(sportFromLeagueKey(key)).toBe(expected);
  });

  it("returns null for unsupported sports (e.g. hockey)", () => {
    expect(sportFromLeagueKey("hockey/nhl")).toBeNull();
  });
});

describe("scoreboardForLeague — parses ESPN site-v2 events", () => {
  it("NFL fixture: final game gets status='final' with scores", async () => {
    const matches = await scoreboardForLeague("football/nfl", "2026-01-15", {
      fetchFn: mockJsonFetch(nflScoreboard),
    });
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const finalGame = matches.find((m) => m.id === "401547544");
    expect(finalGame).toBeDefined();
    expect(finalGame!.status).toBe("final");
    expect(finalGame!.sport).toBe("American Football");
    expect(finalGame!.leagueId).toBe("football/nfl");
    expect(finalGame!.leagueName).toBe("National Football League");
    expect(finalGame!.homeTeamId).toBe("12");
    expect(finalGame!.homeTeamName).toBe("Kansas City Chiefs");
    expect(finalGame!.awayTeamId).toBe("11");
    expect(finalGame!.homeScore).toBe(27);
    expect(finalGame!.awayScore).toBe(20);
    expect(finalGame!.venue).toBe("Arrowhead Stadium");
    expect(finalGame!.broadcast).toBe("CBS");
    expect(finalGame!.round).toBe("Divisional Round");
    expect(finalGame!.liveProgress).toBeUndefined();
  });

  it("NFL fixture: in-progress game gets status='live' with liveProgress", async () => {
    const matches = await scoreboardForLeague("football/nfl", "2026-01-15", {
      fetchFn: mockJsonFetch(nflScoreboard),
    });
    const liveGame = matches.find((m) => m.id === "401547545");
    expect(liveGame).toBeDefined();
    expect(liveGame!.status).toBe("live");
    expect(liveGame!.liveProgress).toBe("Q3 8:21");
    expect(liveGame!.homeScore).toBe(14);
    expect(liveGame!.awayScore).toBe(10);
    expect(liveGame!.broadcast).toBe("NBC");
  });

  it("NBA fixture: scheduled game gets status='upcoming' with no scores", async () => {
    const matches = await scoreboardForLeague("basketball/nba", "2026-02-11", {
      fetchFn: mockJsonFetch(nbaScoreboard),
    });
    expect(matches).toHaveLength(1);
    const game = matches[0]!;
    expect(game.status).toBe("upcoming");
    expect(game.homeScore).toBeUndefined();
    expect(game.awayScore).toBeUndefined();
    expect(game.liveProgress).toBeUndefined();
    expect(game.sport).toBe("Basketball");
    expect(game.leagueId).toBe("basketball/nba");
  });

  it("EPL fixture: parses kickoff timestamp directly into kickoffUtc (no Z workaround)", async () => {
    const matches = await scoreboardForLeague("soccer/eng.1", "2026-03-08", {
      fetchFn: mockJsonFetch(eplScoreboard),
    });
    expect(matches).toHaveLength(1);
    const game = matches[0]!;
    expect(game.kickoffUtc).toBe("2026-03-08T16:30Z");
    expect(game.dateUtc).toBe("2026-03-08");
    expect(game.sport).toBe("Soccer");
    expect(game.leagueId).toBe("soccer/eng.1");
    expect(game.status).toBe("live");
    expect(game.liveProgress).toBe("73'");
    expect(game.broadcast).toBe("USA Network, Peacock");
  });

  it("returns [] when events field is null", async () => {
    const matches = await scoreboardForLeague("basketball/nba", "2026-07-04", {
      fetchFn: mockJsonFetch(emptyScoreboard),
    });
    expect(matches).toEqual([]);
  });

  it("returns [] when events field is absent", async () => {
    const matches = await scoreboardForLeague("basketball/nba", "2026-07-04", {
      fetchFn: mockJsonFetch({ leagues: [] }),
    });
    expect(matches).toEqual([]);
  });

  it("throws a descriptive error on non-2xx responses", async () => {
    const fetchFn = async () =>
      new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      });
    await expect(
      scoreboardForLeague("football/nfl", "2026-01-15", { fetchFn }),
    ).rejects.toThrow(/ESPN 503 Service Unavailable/);
  });

  it("returns [] for an unsupported league key", async () => {
    const matches = await scoreboardForLeague("hockey/nhl", "2026-06-29", {
      fetchFn: mockJsonFetch(nflScoreboard),
    });
    expect(matches).toEqual([]);
  });
});

describe("leagueTeams — parses ESPN site-v2 teams endpoint", () => {
  it("NFL teams fixture: returns typed Team rows with sport and badge", async () => {
    const teams = await leagueTeams("football/nfl", {
      fetchFn: mockJsonFetch(nflTeams),
    });
    expect(teams).toHaveLength(2);
    expect(teams[0]).toEqual({
      id: "12",
      name: "Kansas City Chiefs",
      sport: "American Football",
      badgeUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
    });
    expect(teams[1]!.id).toBe("11");
    expect(teams[1]!.badgeUrl).toBeUndefined();
  });

  it("returns [] when the sports array is missing", async () => {
    const teams = await leagueTeams("football/nfl", {
      fetchFn: mockJsonFetch({}),
    });
    expect(teams).toEqual([]);
  });
});

describe("fetchEventCoreDetail — opt-in fallback", () => {
  it("rejects URLs that don't target sports.core.api.espn.com", async () => {
    await expect(
      fetchEventCoreDetail("https://site.api.espn.com/foo", {
        fetchFn: mockJsonFetch({}),
      }),
    ).rejects.toThrow(/Refusing non-core/);
  });

  it("accepts a sports.core.api.espn.com URL", async () => {
    const payload = { venue: { fullName: "Camp Nou" } };
    const out = await fetchEventCoreDetail<typeof payload>(
      "https://sports.core.api.espn.com/v2/sports/soccer/leagues/esp.1/events/123",
      { fetchFn: mockJsonFetch(payload) },
    );
    expect(out.venue.fullName).toBe("Camp Nou");
  });
});
