import { describe, expect, it } from "vitest";
import eventsdaySoccer from "./__fixtures__/eventsday-soccer.json" with { type: "json" };
import eventsdayFootball from "./__fixtures__/eventsday-american-football.json" with { type: "json" };
import eventsdayBasketball from "./__fixtures__/eventsday-basketball.json" with { type: "json" };
import eventsdayTennis from "./__fixtures__/eventsday-tennis.json" with { type: "json" };
import searchteams from "./__fixtures__/searchteams.json" with { type: "json" };
import searchLeaguesSoccer from "./__fixtures__/search-all-leagues-soccer.json" with { type: "json" };

import {
  buildEventsDayUrl,
  buildEventsLastUrl,
  buildEventsNextUrl,
  buildSearchAllLeaguesUrl,
  buildSearchTeamsUrl,
  eventsDay,
  searchAllLeagues,
  searchTeams,
} from "./client";

describe("TheSportsDB URL builders", () => {
  it("builds eventsday URL with d=YYYY-MM-DD and s=<Sport>", () => {
    const url = buildEventsDayUrl("2026-06-22", "Soccer");
    expect(url).toBe(
      "https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=2026-06-22&s=Soccer",
    );
  });

  it("URL-encodes the sport name (American Football has a space)", () => {
    const url = buildEventsDayUrl("2026-06-23", "American Football");
    expect(url).toContain("s=American+Football");
  });

  it("builds eventsnext URL with the team id encoded", () => {
    expect(buildEventsNextUrl("133604")).toBe(
      "https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=133604",
    );
  });

  it("builds eventslast URL with the team id encoded", () => {
    expect(buildEventsLastUrl("133604")).toBe(
      "https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=133604",
    );
  });

  it("builds searchteams URL with the query URL-encoded", () => {
    expect(buildSearchTeamsUrl("Team USA")).toBe(
      "https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Team%20USA",
    );
  });

  it("builds search_all_leagues URL with sport URL-encoded", () => {
    expect(buildSearchAllLeaguesUrl("American Football")).toBe(
      "https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?s=American%20Football",
    );
  });
});

function mockJsonFetch(body: unknown): typeof fetch {
  return (async () => {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("eventsDay parser", () => {
  it("parses Soccer fixture: a 'final' and a 'live' event with scores and progress", async () => {
    const matches = await eventsDay("2026-06-22", "Soccer", {
      fetchFn: mockJsonFetch(eventsdaySoccer),
    });
    expect(matches).toHaveLength(2);

    const final = matches[0]!;
    expect(final.id).toBe("2052901");
    expect(final.sport).toBe("Soccer");
    expect(final.homeTeamName).toBe("Arsenal");
    expect(final.awayTeamName).toBe("Chelsea");
    expect(final.leagueId).toBe("4328");
    expect(final.status).toBe("final");
    expect(final.homeScore).toBe(2);
    expect(final.awayScore).toBe(1);
    expect(final.round).toBe("Matchweek 38");
    expect(final.venue).toBe("Emirates Stadium");
    expect(final.broadcast).toBe("NBC Sports");
    expect(final.liveProgress).toBeUndefined();

    const live = matches[1]!;
    expect(live.status).toBe("live");
    expect(live.homeScore).toBe(1);
    expect(live.awayScore).toBe(1);
    expect(live.liveProgress).toBe("73'");
  });

  it("parses American Football fixture: 'upcoming' has no score", async () => {
    const matches = await eventsDay("2026-06-23", "American Football", {
      fetchFn: mockJsonFetch(eventsdayFootball),
    });
    expect(matches).toHaveLength(1);
    const m = matches[0]!;
    expect(m.sport).toBe("American Football");
    expect(m.status).toBe("upcoming");
    expect(m.homeScore).toBeUndefined();
    expect(m.awayScore).toBeUndefined();
    expect(m.kickoffUtc).toBe("2026-06-23T20:20:00");
  });

  it("parses Basketball fixture: 'final' with both scores", async () => {
    const matches = await eventsDay("2026-06-21", "Basketball", {
      fetchFn: mockJsonFetch(eventsdayBasketball),
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.status).toBe("final");
    expect(matches[0]!.homeScore).toBe(118);
    expect(matches[0]!.awayScore).toBe(112);
  });

  it("parses Tennis fixture: 'live' with set progress", async () => {
    const matches = await eventsDay("2026-06-22", "Tennis", {
      fetchFn: mockJsonFetch(eventsdayTennis),
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.status).toBe("live");
    expect(matches[0]!.liveProgress).toBe("Set 4");
  });

  it("returns [] when the API responds with events: null (no matches that day)", async () => {
    const matches = await eventsDay("2026-06-22", "Soccer", {
      fetchFn: mockJsonFetch({ events: null }),
    });
    expect(matches).toEqual([]);
  });

  it("throws when the upstream returns a non-OK status", async () => {
    const failingFetch = (async () =>
      ({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({}),
      }) as Response) as unknown as typeof fetch;

    await expect(
      eventsDay("2026-06-22", "Soccer", { fetchFn: failingFetch }),
    ).rejects.toThrow(/503/);
  });
});

describe("searchTeams parser", () => {
  it("maps RawTeam fixtures into Team[]", async () => {
    const teams = await searchTeams("Arsenal", {
      fetchFn: mockJsonFetch(searchteams),
    });
    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({ id: "133604", name: "Arsenal" });
    expect(teams[0]!.badgeUrl).toContain("https://");
    expect(teams[1]).toMatchObject({
      id: "134918",
      name: "Kansas City Chiefs",
    });
  });

  it("returns [] when the API responds with teams: null", async () => {
    const teams = await searchTeams("nonexistent", {
      fetchFn: mockJsonFetch({ teams: null }),
    });
    expect(teams).toEqual([]);
  });
});

describe("searchAllLeagues parser", () => {
  it("maps RawLeague fixtures into League[] with the normalized sport", async () => {
    const leagues = await searchAllLeagues("Soccer", {
      fetchFn: mockJsonFetch(searchLeaguesSoccer),
    });
    expect(leagues.length).toBeGreaterThanOrEqual(3);
    const premierLeague = leagues.find((l) => l.id === "4328");
    expect(premierLeague?.name).toBe("English Premier League");
    expect(premierLeague?.sport).toBe("Soccer");
  });
});
