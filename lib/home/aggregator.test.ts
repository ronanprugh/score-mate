import { describe, expect, it, vi, beforeEach } from "vitest";

/* -------------------------------------------------------------------------- */
/* Mock the favorites query layer so the aggregator stays a pure function     */
/* under test (no DB).                                                         */
/* -------------------------------------------------------------------------- */

const listMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  listFavoritesForUser: (...args: unknown[]) => listMock(...args),
  createFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
}));

import {
  aggregateMatchesForUser,
  buildHomeEnvelope,
  planLeagueKeys,
  sortKeyForTournamentCard,
  type EventsLeagueDayFetcher,
  type Fetchers,
} from "./aggregator";
import { leagueKeysForSport } from "@/lib/espn/leagues";
import type { Match } from "@/lib/sports/types";
import type { FavoriteRow } from "@/db/schema/favorites";
import type { ActiveTournament } from "./tennis-aggregator";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const DATES = {
  yesterday: "2026-06-21",
  today: "2026-06-22",
  tomorrow: "2026-06-23",
} as const;

function fav(
  overrides: Partial<FavoriteRow> & Pick<FavoriteRow, "type">,
): FavoriteRow {
  return {
    id: "f-1",
    userId: "user-a",
    externalId: "ext-1",
    displayName: "Display",
    sport: "Soccer",
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function match(overrides: Partial<Match> & Pick<Match, "id">): Match {
  return {
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: "Home",
    awayTeamId: "a",
    awayTeamName: "Away",
    leagueId: "soccer/eng.1",
    leagueName: "English Premier League",
    dateUtc: DATES.today,
    kickoffUtc: `${DATES.today}T15:00:00Z`,
    status: "upcoming",
    ...overrides,
  };
}

/**
 * Build a fetcher whose lookup table is keyed by `${leagueKey}|${date}`.
 * A value of `Error` is rethrown so we can test partial-failure.
 */
function fetcherFrom(
  table: Record<string, Match[] | Error>,
): EventsLeagueDayFetcher {
  return async (leagueKey, date) => {
    const slot = table[`${leagueKey}|${date}`];
    if (slot instanceof Error) throw slot;
    return slot ?? [];
  };
}

function fetchersFrom(
  table: Record<string, Match[] | Error>,
  tennisFetcher?: () => Promise<ActiveTournament[]>,
): Fetchers {
  return {
    eventsLeagueDay: fetcherFrom(table),
    activeTennisTournaments: tennisFetcher ?? (() => Promise.resolve([])),
  };
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe("planLeagueKeys", () => {
  it("returns [] for a user with no favorites", () => {
    expect(planLeagueKeys([])).toEqual([]);
  });

  it("a single Sport favorite expands to every supported league in that sport", () => {
    const favs: FavoriteRow[] = [
      fav({ type: "sport", sport: "Basketball", externalId: "Basketball" }),
    ];
    const keys = planLeagueKeys(favs);
    expect(new Set(keys)).toEqual(new Set(leagueKeysForSport("Basketball")));
  });

  it("a Team favorite (Soccer) expands to all 14 Soccer leagues", () => {
    const favs: FavoriteRow[] = [
      fav({ type: "team", sport: "Soccer", externalId: "359" }),
    ];
    expect(planLeagueKeys(favs)).toHaveLength(14);
  });

  it("an Event favorite contributes its catalog leagueId (subsumed if same sport's leagues already present)", () => {
    const favs: FavoriteRow[] = [
      fav({
        type: "event",
        sport: "Soccer",
        externalId: "fifa-world-cup-2026",
      }),
    ];
    const keys = planLeagueKeys(favs);
    expect(keys).toContain("soccer/fifa.world");
    // Still 14 (the World Cup key is one of the 14 Soccer leagues).
    expect(keys).toHaveLength(14);
  });
});

describe("aggregateMatchesForUser", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("returns an empty envelope for a user with zero favorites (no fetcher calls)", async () => {
    listMock.mockResolvedValue([]);
    const fetcher = vi.fn<EventsLeagueDayFetcher>(async () => []);
    const env = await aggregateMatchesForUser("user-a", DATES, {
      eventsLeagueDay: fetcher,
      activeTennisTournaments: async () => [],
    });
    expect(env).toEqual({
      yesterday: [],
      today: [],
      tomorrow: [],
      activeTennisTournaments: [],
      source: { ok: true, errors: [] },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fans out exactly (leagueKeys × 5 dates) calls — one Basketball Team favorite → 15 calls", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Basketball", externalId: "13" }),
    ]);
    const fetcher = vi.fn<EventsLeagueDayFetcher>(async () => []);
    await aggregateMatchesForUser("user-a", DATES, {
      eventsLeagueDay: fetcher,
      activeTennisTournaments: async () => [],
    });
    // 3 Basketball leagues × 5 widened dates = 15 calls.
    expect(fetcher).toHaveBeenCalledTimes(15);
    const calledKeys = new Set(fetcher.mock.calls.map((c) => c[0]));
    expect(calledKeys).toEqual(
      new Set([
        "basketball/nba",
        "basketball/wnba",
        "basketball/mens-college-basketball",
      ]),
    );
  });

  it("widens the UTC fetch window by ±1 day (5 dates per league)", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Basketball", externalId: "13" }),
    ]);
    const fetcher = vi.fn<EventsLeagueDayFetcher>(async () => []);
    await aggregateMatchesForUser("user-a", DATES, {
      eventsLeagueDay: fetcher,
      activeTennisTournaments: async () => [],
    });
    const dates = new Set(fetcher.mock.calls.map((c) => c[1]));
    expect(dates).toEqual(
      new Set([
        "2026-06-20", // yesterday - 1
        DATES.yesterday,
        DATES.today,
        DATES.tomorrow,
        "2026-06-24", // tomorrow + 1
      ]),
    );
  });

  it("partitions matches by local date, sorts by kickoff, dedupes by id", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Basketball", externalId: "13" }),
    ]);
    const yesterdayLate = match({
      id: "y-late",
      sport: "Basketball",
      leagueId: "basketball/nba",
      leagueName: "NBA",
      dateUtc: DATES.yesterday,
      kickoffUtc: `${DATES.yesterday}T22:00:00Z`,
      status: "final",
      homeScore: 100,
      awayScore: 98,
      homeTeamId: "13",
    });
    const yesterdayEarly = match({
      id: "y-early",
      sport: "Basketball",
      leagueId: "basketball/nba",
      leagueName: "NBA",
      dateUtc: DATES.yesterday,
      kickoffUtc: `${DATES.yesterday}T19:00:00Z`,
      status: "final",
      homeScore: 88,
      awayScore: 91,
      homeTeamId: "13",
    });
    const fetchers = fetchersFrom({
      [`basketball/nba|${DATES.yesterday}`]: [yesterdayLate, yesterdayEarly],
    });

    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.source.ok).toBe(true);
    expect(env.yesterday.map((m) => m.id)).toEqual(["y-early", "y-late"]);
  });

  it("partial-failure: a rejected upstream yields source.ok=false plus successful data", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Basketball", externalId: "13" }),
    ]);
    const liveMatch = match({
      id: "t-bball",
      sport: "Basketball",
      leagueId: "basketball/nba",
      leagueName: "NBA",
      dateUtc: DATES.today,
      kickoffUtc: `${DATES.today}T18:00:00Z`,
      homeTeamId: "13",
    });
    const fetchers = fetchersFrom({
      [`basketball/nba|${DATES.today}`]: [liveMatch],
      [`basketball/wnba|${DATES.today}`]: new Error(
        "ESPN 503 Service Unavailable",
      ),
    });
    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.source.ok).toBe(false);
    expect(env.source.errors).toHaveLength(1);
    expect(env.source.errors[0]).toMatch(/503/);
    expect(env.today.map((m) => m.id)).toEqual(["t-bball"]);
  });

  it("ignores matches whose local date falls outside the [y/t/t] window", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "359" }),
    ]);
    const outOfWindow = match({
      id: "out-of-window",
      sport: "Soccer",
      homeTeamId: "359",
      leagueId: "soccer/eng.1",
      dateUtc: "2026-06-30",
      kickoffUtc: "2026-06-30T15:00:00Z",
    });
    const fetchers = fetchersFrom({
      [`soccer/eng.1|${DATES.today}`]: [outOfWindow],
    });
    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.yesterday).toEqual([]);
    expect(env.today).toEqual([]);
    expect(env.tomorrow).toEqual([]);
  });

  it("buckets by LOCAL date — a UTC-tomorrow match that's locally today goes to `today`", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "359" }),
    ]);
    // Kicks off 01:00 UTC on 2026-06-23 → 21:00 ET on 2026-06-22.
    const lateNight = match({
      id: "late-et",
      sport: "Soccer",
      homeTeamId: "359",
      leagueId: "soccer/eng.1",
      dateUtc: "2026-06-23",
      kickoffUtc: "2026-06-23T01:00:00Z",
    });
    const fetchers = fetchersFrom({
      [`soccer/eng.1|${DATES.tomorrow}`]: [lateNight],
    });
    const env = await aggregateMatchesForUser(
      "user-a",
      DATES,
      fetchers,
      "America/New_York",
    );
    expect(env.today.map((m) => m.id)).toEqual(["late-et"]);
    expect(env.tomorrow.map((m) => m.id)).toEqual([]);
  });

  it("expands an Event favorite to its catalog leagueId (FIFA World Cup 2026 → soccer/fifa.world)", async () => {
    listMock.mockResolvedValue([
      fav({
        type: "event",
        sport: "Soccer",
        externalId: "fifa-world-cup-2026",
        metadata: { startDate: "2026-06-11", endDate: "2026-07-19" },
      }),
    ]);
    const fetcher = vi.fn<EventsLeagueDayFetcher>(async () => []);
    await aggregateMatchesForUser("user-a", DATES, {
      eventsLeagueDay: fetcher,
      activeTennisTournaments: async () => [],
    });
    const keys = new Set(fetcher.mock.calls.map((c) => c[0]));
    expect(keys).toContain("soccer/fifa.world");
  });

  it("dedupes a match claimed by two favorites (Team + League) — appears exactly once", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "359" }),
      fav({
        id: "f-2",
        type: "league",
        sport: "Soccer",
        externalId: "soccer/eng.1",
      }),
    ]);
    const claimed = match({
      id: "dup",
      sport: "Soccer",
      homeTeamId: "359",
      leagueId: "soccer/eng.1",
      dateUtc: DATES.today,
    });
    const fetchers = fetchersFrom({
      [`soccer/eng.1|${DATES.today}`]: [claimed],
    });
    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.today.map((m) => m.id)).toEqual(["dup"]);
  });

  it("populates activeTennisTournaments from the tennis fetcher", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "359" }),
    ]);
    const tennisTournament: ActiveTournament = {
      id: "tennis/slam/roland-garros",
      displayName: "Roland Garros",
      tour: "Slam",
      startDate: DATES.today,
      endDate: DATES.today,
      currentRound: "Semifinals",
      liveCount: 2,
      upcomingCount: 0,
      doneCount: 0,
      matches: [],
    };
    const fetchers = fetchersFrom({}, async () => [tennisTournament]);
    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.activeTennisTournaments).toHaveLength(1);
    expect(env.activeTennisTournaments[0]?.id).toBe(
      "tennis/slam/roland-garros",
    );
  });

  it("on tennis fetcher rejection: envelope succeeds with activeTennisTournaments=[] and a source.errors entry", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "359" }),
    ]);
    const fetchers = fetchersFrom({}, async () => {
      throw new Error("Tennis 503");
    });
    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.activeTennisTournaments).toEqual([]);
    expect(env.source.ok).toBe(false);
    expect(env.source.errors).toHaveLength(1);
    expect(env.source.errors[0]).toMatch(/Tennis 503/);
  });

  it("EMPTY_ENVELOPE includes activeTennisTournaments field defaulting to []", async () => {
    listMock.mockResolvedValue([]);
    const env = await aggregateMatchesForUser("user-a", DATES, {
      eventsLeagueDay: async () => [],
      activeTennisTournaments: async () => [],
    });
    expect(env).toHaveProperty("activeTennisTournaments", []);
  });
});

describe("buildHomeEnvelope (pure)", () => {
  it("sorts matches lacking kickoffUtc to the end of the day", () => {
    const m1 = match({
      id: "with-time",
      kickoffUtc: `${DATES.today}T20:00:00Z`,
    });
    const m2 = match({ id: "no-time", kickoffUtc: null });
    const m3 = match({ id: "early", kickoffUtc: `${DATES.today}T08:00:00Z` });
    const fav1 = fav({ type: "team", externalId: "h", sport: "Soccer" });
    const env = buildHomeEnvelope([fav1], [m1, m2, m3], DATES);
    expect(env.today.map((m) => m.id)).toEqual([
      "early",
      "with-time",
      "no-time",
    ]);
  });
});

describe("sortKeyForTournamentCard", () => {
  function tennisMatch(
    id: string,
    status: "live" | "upcoming" | "final",
    kickoffUtc: string | null,
  ): ActiveTournament["matches"][number] {
    return match({
      id,
      sport: "Tennis",
      leagueId: "tennis/slam/wimbledon",
      leagueName: "Wimbledon",
      status,
      kickoffUtc,
    });
  }

  it("returns earliest live/upcoming kickoffUtc as the sort key", () => {
    const t: ActiveTournament = {
      id: "tennis/slam/wimbledon",
      displayName: "Wimbledon",
      tour: "Slam",
      startDate: DATES.today,
      endDate: DATES.today,
      currentRound: "QF",
      liveCount: 1,
      upcomingCount: 1,
      doneCount: 1,
      matches: [
        tennisMatch("m1", "final", `${DATES.today}T10:00:00Z`),
        tennisMatch("m2", "live", `${DATES.today}T14:00:00Z`),
        tennisMatch("m3", "upcoming", `${DATES.today}T12:00:00Z`),
      ],
    };
    expect(sortKeyForTournamentCard(t)).toBe(`${DATES.today}T12:00:00Z`);
  });

  it("falls back to sentinel when no live/upcoming matches — sorts below all match cards", () => {
    const t: ActiveTournament = {
      id: "tennis/slam/us-open",
      displayName: "US Open",
      tour: "Slam",
      startDate: DATES.today,
      endDate: DATES.today,
      currentRound: "Final",
      liveCount: 0,
      upcomingCount: 0,
      doneCount: 3,
      matches: [
        tennisMatch("f1", "final", `${DATES.today}T18:00:00Z`),
        tennisMatch("f2", "final", `${DATES.today}T20:00:00Z`),
      ],
    };
    expect(sortKeyForTournamentCard(t)).toBe("9999-12-31T23:59:59");
  });

  it("treats null kickoffUtc on a live/upcoming match as the sentinel", () => {
    const t: ActiveTournament = {
      id: "tennis/atp/miami",
      displayName: "Miami Open",
      tour: "ATP",
      startDate: DATES.today,
      endDate: DATES.today,
      currentRound: "R32",
      liveCount: 0,
      upcomingCount: 1,
      doneCount: 0,
      matches: [tennisMatch("u1", "upcoming", null)],
    };
    expect(sortKeyForTournamentCard(t)).toBe("9999-12-31T23:59:59");
  });
});
