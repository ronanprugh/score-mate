import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nflScoreboard from "./__fixtures__/nfl-scoreboard.json" with { type: "json" };
import nbaScoreboard from "./__fixtures__/nba-scoreboard.json" with { type: "json" };
import eplScoreboard from "./__fixtures__/epl-scoreboard.json" with { type: "json" };
import emptyScoreboard from "./__fixtures__/empty-scoreboard.json" with { type: "json" };
import nflTeams from "./__fixtures__/nfl-teams.json" with { type: "json" };
import liverpoolEmptySchedule from "./__fixtures__/liverpool-eng1-empty-schedule.json" with { type: "json" };
import liverpoolSchedule2025 from "./__fixtures__/liverpool-eng1-schedule-2025.json" with { type: "json" };

import {
  athleteMatchHistory,
  buildLeagueTeamsUrl,
  buildScoreboardUrl,
  buildTeamScheduleUrl,
  currentEspnSeasonYear,
  fetchEventCoreDetail,
  leagueTeams,
  scoreboardForLeague,
  searchAthletes,
  sportFromLeagueKey,
  teamScheduleForLeague,
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

  it("team schedule URL appends the season when one is given", () => {
    expect(buildTeamScheduleUrl("soccer/eng.1", "364", 2025)).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule?season=2025",
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

describe("athleteMatchHistory — full Match[] for the entity detail screen", () => {
  const DAY = 86_400_000;
  const past = (days: number) =>
    new Date(Date.now() - days * DAY).toISOString();
  const future = (days: number) =>
    new Date(Date.now() + days * DAY).toISOString();

  it("team-sport player: returns full Match[] with both sides, capped at 10 recent + 10 upcoming", async () => {
    const items = [];
    const routes: Record<string, unknown> = {};
    // 15 completed + 15 upcoming games to prove the cap actually trims.
    // Zero-padded indices avoid substring collisions in routedFetch's URL
    // matching (e.g. "/events/old-1" is a substring of "/events/old-14").
    const pad = (n: number) => String(n).padStart(2, "0");
    for (let i = 0; i < 15; i++) {
      items.push({
        teamId: "13",
        event: { $ref: `http://x/events/old-${pad(i)}` },
      });
      routes[`/events/old-${pad(i)}`] = {
        date: past(30 - i),
        name: "Phoenix Suns at Los Angeles Lakers",
        competitions: [
          {
            competitors: [
              { id: "13", homeAway: "home", winner: true, score: "110" },
              { id: "9", homeAway: "away", winner: false, score: "100" },
            ],
          },
        ],
      };
      items.push({
        teamId: "13",
        event: { $ref: `http://x/events/next-${pad(i)}` },
      });
      routes[`/events/next-${pad(i)}`] = {
        date: future(i + 1),
        name: "Los Angeles Lakers at Boston Celtics",
        competitions: [
          {
            competitors: [
              { id: "2", homeAway: "home" },
              { id: "13", homeAway: "away" },
            ],
          },
        ],
      };
    }
    routes["/athletes/1966/eventlog"] = { events: { items } };
    const fetchFn = routedFetch(routes);

    const { recent, upcoming } = await athleteMatchHistory(
      "basketball/nba",
      "1966",
      { fetchFn },
    );

    expect(recent).toHaveLength(10);
    expect(upcoming).toHaveLength(10);
    // Most-recent-first: old-14 (30-14=16 days ago) is the most recent.
    expect(recent[0]!.id).toBe("http://x/events/old-14");
    expect(recent[0]!.homeTeamName).toBe("Los Angeles Lakers");
    expect(recent[0]!.awayTeamName).toBe("Phoenix Suns");
    expect(recent[0]!.status).toBe("final");
    expect(recent[0]!.homeScore).toBe(110);
    expect(recent[0]!.awayScore).toBe(100);
    // Soonest-first: next-00 (1 day out) is first.
    expect(upcoming[0]!.id).toBe("http://x/events/next-00");
    expect(upcoming[0]!.status).toBe("upcoming");
    expect(upcoming[0]!.homeScore).toBeUndefined();
  });

  it("tennis player: returns matches with populated set-by-set tennis detail", async () => {
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
        type: { text: "Men's Singles" },
        round: { displayName: "Round 1" },
        venue: { court: "Court 8" },
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

    const { recent, upcoming } = await athleteMatchHistory(
      "tennis/atp",
      "3623",
      {
        fetchFn,
      },
    );

    expect(recent).toHaveLength(1);
    const match = recent[0]!;
    expect(match.sport).toBe("Tennis");
    expect(match.status).toBe("final");
    expect(match.tennis).toBeDefined();
    expect(match.tennis!.draw).toBe("Men's Singles");
    expect(match.tennis!.round).toBe("Round 1");
    expect(match.tennis!.court).toBe("Court 8");
    expect(match.tennis!.home.won).toBe(true);
    expect(match.tennis!.home.sets).toEqual([
      { games: 7, won: true },
      { games: 7, won: true },
      { games: 6, won: true },
    ]);
    expect(match.tennis!.away.sets).toEqual([
      { games: 5, won: false },
      { games: 6, won: false },
      { games: 3, won: false },
    ]);

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]!.status).toBe("upcoming");
    expect(upcoming[0]!.tennis!.home.sets).toEqual([]);
  });

  it("returns empty recent/upcoming (never throws) when the eventlog fetch fails", async () => {
    const { recent, upcoming } = await athleteMatchHistory(
      "tennis/wta",
      "3626",
      {
        fetchFn: async () => {
          throw new Error("boom");
        },
      },
    );
    expect(recent).toEqual([]);
    expect(upcoming).toEqual([]);
  });

  it("returns empty recent/upcoming when the athlete has no eventlog items", async () => {
    const fetchFn = routedFetch({
      "/athletes/9999/eventlog": { events: { items: [] } },
    });
    const { recent, upcoming } = await athleteMatchHistory(
      "basketball/nba",
      "9999",
      { fetchFn },
    );
    expect(recent).toEqual([]);
    expect(upcoming).toEqual([]);
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

describe("teamScheduleForLeague — season resolution (Spec 13, Unit 1)", () => {
  /**
   * ESPN's `/schedule` endpoint has no documented season contract: it rolls to
   * the next season as soon as one is registered, and an unpublished season
   * answers 200 with `events: []`. These fixtures are the real payloads
   * recorded on 2026-08-05 for Liverpool (team 364).
   */
  const routes = {
    "season=2026": liverpoolEmptySchedule,
    "season=2025": liverpoolSchedule2025,
  };

  /**
   * Soccer schedules arrive in two halves (`?fixture=true` for upcoming), so
   * every soccer season costs two requests. `routedFetch` matches by substring
   * and `fixture=true` is appended last, so a bare `season=YYYY` key serves
   * both halves — fine wherever the test only counts requests. Tests that need
   * the halves to differ list the `&fixture=true` key first, since
   * `routedFetch` takes the first matching key.
   */
  const HALVES_PER_SEASON = 2;

  /** Wraps a fetchFn so the test can assert how many requests were issued. */
  function recordingFetch(inner: typeof fetch) {
    const urls: string[] = [];
    const fn: typeof fetch = (url, init) => {
      urls.push(String(url));
      return inner(url, init);
    };
    return { fetchFn: fn, urls };
  }

  beforeEach(() => {
    // Pin the clock so the derived season is stable, not a function of the
    // year the suite happens to run in.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives the current season from the clock", () => {
    expect(currentEspnSeasonYear()).toBe(2026);
    expect(currentEspnSeasonYear(new Date("2025-01-02T00:00:00Z"))).toBe(2025);
  });

  it("falls back to the previous season when the current season is empty", async () => {
    const { fetchFn } = recordingFetch(routedFetch(routes));
    const matches = await teamScheduleForLeague("soccer/eng.1", "364", {
      fetchFn,
    });

    expect(matches).toHaveLength(4);
    expect(matches[0]?.homeTeamName).toBe("Liverpool");
  });

  it("issues exactly two seasons' worth of requests when falling back", async () => {
    const { fetchFn, urls } = recordingFetch(routedFetch(routes));
    await teamScheduleForLeague("soccer/eng.1", "364", { fetchFn });

    expect(urls).toHaveLength(2 * HALVES_PER_SEASON);
    expect(urls.filter((u) => u.includes("season=2026"))).toHaveLength(
      HALVES_PER_SEASON,
    );
    expect(urls.filter((u) => u.includes("season=2025"))).toHaveLength(
      HALVES_PER_SEASON,
    );
    // Current season first, then the fallback.
    expect(urls[0]).toContain("season=2026");
    expect(urls.at(-1)).toContain("season=2025");
  });

  it("issues no fallback request when the current season is populated", async () => {
    const { fetchFn, urls } = recordingFetch(
      routedFetch({ "season=2026": liverpoolSchedule2025 }),
    );
    const matches = await teamScheduleForLeague("soccer/eng.1", "364", {
      fetchFn,
    });

    expect(matches).toHaveLength(4);
    expect(urls).toHaveLength(HALVES_PER_SEASON);
    for (const u of urls) expect(u).toContain("season=2026");
  });

  it("resolves to an empty array (does not throw) when both seasons are empty", async () => {
    const { fetchFn, urls } = recordingFetch(
      routedFetch({
        "season=2026": liverpoolEmptySchedule,
        "season=2025": liverpoolEmptySchedule,
      }),
    );

    await expect(
      teamScheduleForLeague("soccer/eng.1", "364", { fetchFn }),
    ).resolves.toEqual([]);
    // Still bounded at one retry — no walking backwards through seasons.
    expect(urls).toHaveLength(2 * HALVES_PER_SEASON);
  });

  it("reaches back and merges when the current season has fixtures but no results", async () => {
    // The failure mode a bare `length === 0` check misses: ESPN registers a
    // single next-season fixture mid-season, the current-season response is
    // non-empty, and a whole season of results silently disappears.
    const oneFutureFixture = {
      events: [
        {
          ...liverpoolSchedule2025.events[0],
          id: "next-season-opener",
          date: "2026-08-15T19:00Z",
          competitions: [
            {
              ...liverpoolSchedule2025.events[0].competitions[0],
              status: { type: { state: "pre" } },
            },
          ],
        },
      ],
    };
    const { fetchFn, urls } = recordingFetch(
      routedFetch({
        "season=2026": oneFutureFixture,
        "season=2025": liverpoolSchedule2025,
      }),
    );

    const matches = await teamScheduleForLeague("soccer/eng.1", "364", {
      fetchFn,
    });

    expect(urls).toHaveLength(2 * HALVES_PER_SEASON);
    // Both seasons, deduped — last season's finale is still reachable as
    // "Last" while the new opener is "Next".
    expect(matches).toHaveLength(5);
    expect(matches.map((m) => m.id)).toContain("next-season-opener");
    expect(matches.filter((m) => m.status === "final")).toHaveLength(4);
  });

  it("issues no fallback once the current season has a completed match", async () => {
    const { fetchFn, urls } = recordingFetch(
      routedFetch({ "season=2026": liverpoolSchedule2025 }),
    );
    await teamScheduleForLeague("soccer/eng.1", "364", { fetchFn });

    expect(urls).toHaveLength(HALVES_PER_SEASON);
  });

  it("honors an explicit season and skips the fallback entirely", async () => {
    const { fetchFn, urls } = recordingFetch(routedFetch(routes));
    const matches = await teamScheduleForLeague("soccer/eng.1", "364", {
      fetchFn,
      season: 2025,
    });

    expect(matches).toHaveLength(4);
    expect(urls).toHaveLength(HALVES_PER_SEASON);
    for (const u of urls) expect(u).toContain("season=2025");
  });

  it("fetches the upcoming half — ESPN lists future soccer fixtures nowhere else", async () => {
    // The Liverpool-vs-Monaco bug: ESPN's soccer team schedule answers with
    // completed fixtures only. The Aug 9 friendly is in the `fixture=true`
    // response and in no other team-scoped one, so without that request every
    // followed soccer team has an empty "Next" — all season, not just
    // preseason.
    const monacoFriendly = {
      events: [
        {
          ...liverpoolSchedule2025.events[0],
          id: "401886533",
          date: "2026-08-09T13:30Z",
          competitions: [
            {
              ...liverpoolSchedule2025.events[0].competitions[0],
              status: { type: { state: "pre" } },
            },
          ],
        },
      ],
    };
    // Specific key first: `routedFetch` takes the first matching substring.
    const { fetchFn, urls } = recordingFetch(
      routedFetch({
        "season=2026&fixture=true": monacoFriendly,
        "season=2026": liverpoolEmptySchedule,
        "season=2025": liverpoolSchedule2025,
      }),
    );

    const matches = await teamScheduleForLeague("soccer/eng.1", "364", {
      fetchFn,
    });

    expect(urls).toContain(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/364/schedule?season=2026&fixture=true",
    );
    expect(matches.map((m) => m.id)).toContain("401886533");
    // And it is the one a card would show as "Next".
    const upcoming = matches.filter((m) => m.status !== "final");
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]?.id).toBe("401886533");
  });

  it("issues one request per season for non-soccer leagues", async () => {
    // MLB returns the whole season either way; `fixture=true` changes nothing
    // there, so only soccer pays for the second request.
    const { fetchFn, urls } = recordingFetch(
      routedFetch({ "season=2026": liverpoolSchedule2025 }),
    );
    await teamScheduleForLeague("baseball/mlb", "16", { fetchFn });

    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain("fixture=true");
  });

  it("prefers the completed copy of a fixture present in both halves", async () => {
    // A match can go final between the two concurrent responses. The
    // completed copy carries the score, so it must win the dedupe.
    const asUpcoming = {
      events: [
        {
          ...liverpoolSchedule2025.events[0],
          competitions: [
            {
              ...liverpoolSchedule2025.events[0].competitions[0],
              status: { type: { state: "pre" } },
            },
          ],
        },
      ],
    };
    const { fetchFn } = recordingFetch(
      routedFetch({
        "season=2026&fixture=true": asUpcoming,
        "season=2026": { events: [liverpoolSchedule2025.events[0]] },
      }),
    );

    const matches = await teamScheduleForLeague("soccer/eng.1", "364", {
      fetchFn,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.status).toBe("final");
  });

  it("still throws on an upstream HTTP failure rather than reading it as 'no matches'", async () => {
    const failing: typeof fetch = async () =>
      new Response("nope", { status: 503, statusText: "Service Unavailable" });

    await expect(
      teamScheduleForLeague("soccer/eng.1", "364", { fetchFn: failing }),
    ).rejects.toThrow(/ESPN 503/);
  });

  it("parses object-shaped scores from the team schedule endpoint", async () => {
    // The scoreboard endpoint sends `score: "2"`; this endpoint sends
    // `score: { value: 2, displayValue: "2" }`. Both must yield a number.
    const { fetchFn } = recordingFetch(routedFetch(routes));
    const matches = await teamScheduleForLeague("soccer/eng.1", "364", {
      fetchFn,
    });

    const settled = matches.filter((m) => m.status === "final");
    expect(settled.length).toBeGreaterThan(0);
    for (const m of settled) {
      expect(typeof m.homeScore).toBe("number");
      expect(typeof m.awayScore).toBe("number");
      expect(Number.isNaN(m.homeScore)).toBe(false);
    }
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
