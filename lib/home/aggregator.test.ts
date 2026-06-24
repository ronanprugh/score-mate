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
  type EventsDayFetcher,
  type EventsLeagueFetcher,
  type EventsTeamFetcher,
  type Fetchers,
} from "./aggregator";
import type { Match, Sport } from "@/lib/sportsdb/types";
import type { FavoriteRow } from "@/db/schema/favorites";

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
    leagueId: "0000",
    leagueName: "Some League",
    dateUtc: DATES.today,
    kickoffUtc: `${DATES.today}T15:00:00`,
    status: "upcoming",
    ...overrides,
  };
}

/** Build an EventsDayFetcher that returns a fixed lookup table. */
function dayFetcherFrom(
  table: Record<string, Record<Sport, Match[] | Error>>,
): EventsDayFetcher {
  return async (date, sport) => {
    const dayMap = table[date];
    if (!dayMap) return [];
    const slot = dayMap[sport];
    if (slot instanceof Error) throw slot;
    return slot ?? [];
  };
}

const noopTeamFetcher: EventsTeamFetcher = async () => [];
const noopLeagueFetcher: EventsLeagueFetcher = async () => [];

/** Build a Fetchers bundle with the given day fetcher and optional overrides. */
function fetchersFrom(
  table: Record<string, Record<Sport, Match[] | Error>>,
  overrides: Partial<Fetchers> = {},
): Fetchers {
  return {
    eventsDay: dayFetcherFrom(table),
    eventsTeam: noopTeamFetcher,
    eventsLeague: noopLeagueFetcher,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe("aggregateMatchesForUser", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("returns an empty envelope (ok=true, no errors) for a user with zero favorites", async () => {
    listMock.mockResolvedValue([]);
    const dayFetcher = vi.fn<EventsDayFetcher>(async () => []);
    const env = await aggregateMatchesForUser("user-a", DATES, {
      eventsDay: dayFetcher,
      eventsTeam: noopTeamFetcher,
      eventsLeague: noopLeagueFetcher,
    });
    expect(env).toEqual({
      yesterday: [],
      today: [],
      tomorrow: [],
      source: { ok: true, errors: [] },
    });
    expect(dayFetcher).not.toHaveBeenCalled();
  });

  it("plans the minimum query set: one call per (date × sport) covered by any favorite", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "team-usa" }),
      fav({
        id: "f-2",
        type: "league",
        sport: "Basketball",
        externalId: "4387",
      }),
    ]);
    const dayFetcher = vi.fn<EventsDayFetcher>(async () => []);
    const teamFetcher = vi.fn<EventsTeamFetcher>(async () => []);
    const leagueFetcher = vi.fn<EventsLeagueFetcher>(async () => []);
    await aggregateMatchesForUser("user-a", DATES, {
      eventsDay: dayFetcher,
      eventsTeam: teamFetcher,
      eventsLeague: leagueFetcher,
    });
    // 2 sports × 3 dates = 6 day calls; no extras for sports not in favorites.
    expect(dayFetcher).toHaveBeenCalledTimes(6);
    // 1 team favorite → 1 team call; 1 league favorite → 1 league call.
    expect(teamFetcher).toHaveBeenCalledWith("team-usa");
    expect(teamFetcher).toHaveBeenCalledTimes(1);
    expect(leagueFetcher).toHaveBeenCalledWith("4387");
    expect(leagueFetcher).toHaveBeenCalledTimes(1);
    const callSports = new Set<Sport>(dayFetcher.mock.calls.map((c) => c[1]));
    expect(callSports).toEqual(new Set<Sport>(["Soccer", "Basketball"]));
    // No American Football / Tennis calls.
    expect(callSports.has("American Football")).toBe(false);
    expect(callSports.has("Tennis")).toBe(false);
  });

  it("partitions matches by date, sorts each day by kickoff, and respects all four sports across the union", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "team-usa" }),
      fav({
        id: "f-2",
        type: "league",
        sport: "Basketball",
        externalId: "4387",
      }),
      fav({
        id: "f-3",
        type: "league",
        sport: "American Football",
        externalId: "4391",
      }),
      fav({
        id: "f-4",
        type: "league",
        sport: "Tennis",
        externalId: "4464",
      }),
    ]);
    const fetchers = fetchersFrom({
      [DATES.yesterday]: {
        Soccer: [],
        Basketball: [
          match({
            id: "y-bball-late",
            sport: "Basketball",
            leagueId: "4387",
            dateUtc: DATES.yesterday,
            kickoffUtc: `${DATES.yesterday}T22:00:00`,
            status: "final",
            homeScore: 100,
            awayScore: 98,
          }),
          match({
            id: "y-bball-early",
            sport: "Basketball",
            leagueId: "4387",
            dateUtc: DATES.yesterday,
            kickoffUtc: `${DATES.yesterday}T19:00:00`,
            status: "final",
            homeScore: 88,
            awayScore: 91,
          }),
        ],
        "American Football": [],
        Tennis: [],
      },
      [DATES.today]: {
        Soccer: [
          match({
            id: "t-soccer",
            sport: "Soccer",
            homeTeamId: "team-usa",
            leagueId: "9999",
            dateUtc: DATES.today,
            kickoffUtc: `${DATES.today}T15:00:00`,
            status: "live",
          }),
        ],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
      [DATES.tomorrow]: {
        Soccer: [],
        Basketball: [],
        "American Football": [
          match({
            id: "tm-nfl",
            sport: "American Football",
            leagueId: "4391",
            dateUtc: DATES.tomorrow,
            kickoffUtc: `${DATES.tomorrow}T20:20:00`,
            status: "upcoming",
          }),
        ],
        Tennis: [],
      },
    });

    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.source.ok).toBe(true);
    expect(env.source.errors).toEqual([]);

    // Yesterday's two basketball matches sorted by kickoff (19:00, 22:00).
    expect(env.yesterday.map((m) => m.id)).toEqual([
      "y-bball-early",
      "y-bball-late",
    ]);
    // Today: the live soccer match for team-usa.
    expect(env.today.map((m) => m.id)).toEqual(["t-soccer"]);
    // Tomorrow: the NFL game.
    expect(env.tomorrow.map((m) => m.id)).toEqual(["tm-nfl"]);
  });

  it("deduplicates a match claimed by two favorites (Team + League) — appears exactly once", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "team-usa" }),
      fav({ id: "f-2", type: "league", sport: "Soccer", externalId: "9999" }),
    ]);
    const claimedMatch = match({
      id: "dup",
      sport: "Soccer",
      homeTeamId: "team-usa",
      leagueId: "9999",
      dateUtc: DATES.today,
    });
    // The same match comes back from the single Soccer-today call (de-duped at
    // the matcher level even though only one fetcher returns it).
    const fetchers = fetchersFrom({
      [DATES.yesterday]: {
        Soccer: [],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
      [DATES.today]: {
        Soccer: [claimedMatch],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
      [DATES.tomorrow]: {
        Soccer: [],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
    });
    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.today.map((m) => m.id)).toEqual(["dup"]);
  });

  it("partial-failure envelope: a single rejected upstream call yields source.ok=false plus successful results", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "team-usa" }),
      fav({
        id: "f-2",
        type: "league",
        sport: "Basketball",
        externalId: "4387",
      }),
    ]);
    const fetchers = fetchersFrom({
      [DATES.yesterday]: {
        Soccer: [],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
      [DATES.today]: {
        Soccer: [
          match({
            id: "t-soccer",
            sport: "Soccer",
            homeTeamId: "team-usa",
            dateUtc: DATES.today,
          }),
        ],
        Basketball: new Error(
          "TheSportsDB 503 Service Unavailable for Basketball",
        ),
        "American Football": [],
        Tennis: [],
      },
      [DATES.tomorrow]: {
        Soccer: [],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
    });

    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.source.ok).toBe(false);
    expect(env.source.errors).toHaveLength(1);
    expect(env.source.errors[0]).toMatch(/503/);
    // Successfully-fetched data still renders.
    expect(env.today.map((m) => m.id)).toEqual(["t-soccer"]);
  });

  it("ignores matches whose dateUtc falls outside the [y/t/t] window", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "team-usa" }),
    ]);
    const fetchers = fetchersFrom({
      [DATES.yesterday]: {
        Soccer: [],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
      [DATES.today]: {
        Soccer: [
          match({
            id: "out-of-window",
            sport: "Soccer",
            homeTeamId: "team-usa",
            dateUtc: "2026-06-30", // 8 days from today
          }),
        ],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
      [DATES.tomorrow]: {
        Soccer: [],
        Basketball: [],
        "American Football": [],
        Tennis: [],
      },
    });
    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.yesterday).toEqual([]);
    expect(env.today).toEqual([]);
    expect(env.tomorrow).toEqual([]);
  });

  it("unions per-team and per-league fetcher results with per-day results before matching", async () => {
    listMock.mockResolvedValue([
      fav({ type: "team", sport: "Soccer", externalId: "team-usa" }),
      fav({ id: "f-2", type: "league", sport: "Soccer", externalId: "9999" }),
    ]);
    // Per-day returns nothing; the match is ONLY in the per-team fetch.
    // This is the exact scenario the league/team fanout was added to fix.
    const teamOnlyMatch = match({
      id: "team-only",
      sport: "Soccer",
      homeTeamId: "team-usa",
      leagueId: "9999",
      dateUtc: DATES.today,
    });
    const leagueOnlyMatch = match({
      id: "league-only",
      sport: "Soccer",
      homeTeamId: "other-team",
      leagueId: "9999",
      dateUtc: DATES.tomorrow,
      kickoffUtc: `${DATES.tomorrow}T20:00:00`,
    });
    const fetchers = fetchersFrom(
      {
        [DATES.yesterday]: {
          Soccer: [],
          Basketball: [],
          "American Football": [],
          Tennis: [],
        },
        [DATES.today]: {
          Soccer: [],
          Basketball: [],
          "American Football": [],
          Tennis: [],
        },
        [DATES.tomorrow]: {
          Soccer: [],
          Basketball: [],
          "American Football": [],
          Tennis: [],
        },
      },
      {
        eventsTeam: async (teamId) => {
          if (teamId === "team-usa") return [teamOnlyMatch];
          return [];
        },
        eventsLeague: async (leagueId) => {
          if (leagueId === "9999") return [leagueOnlyMatch];
          return [];
        },
      },
    );

    const env = await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(env.today.map((m) => m.id)).toEqual(["team-only"]);
    expect(env.tomorrow.map((m) => m.id)).toEqual(["league-only"]);
    expect(env.source.ok).toBe(true);
  });

  it("expands an Event favorite to its catalog leagueId when one exists (FIFA World Cup 2026 → 4429)", async () => {
    listMock.mockResolvedValue([
      fav({
        type: "event",
        sport: "Soccer",
        externalId: "fifa-world-cup-2026",
        metadata: { startDate: "2026-06-11", endDate: "2026-07-19" },
      }),
    ]);
    const leagueFetcher = vi.fn<EventsLeagueFetcher>(async () => []);
    const fetchers = fetchersFrom(
      {
        [DATES.yesterday]: {
          Soccer: [],
          Basketball: [],
          "American Football": [],
          Tennis: [],
        },
        [DATES.today]: {
          Soccer: [],
          Basketball: [],
          "American Football": [],
          Tennis: [],
        },
        [DATES.tomorrow]: {
          Soccer: [],
          Basketball: [],
          "American Football": [],
          Tennis: [],
        },
      },
      { eventsLeague: leagueFetcher },
    );
    await aggregateMatchesForUser("user-a", DATES, fetchers);
    expect(leagueFetcher).toHaveBeenCalledWith("4429");
  });
});

describe("buildHomeEnvelope (pure)", () => {
  it("sorts matches lacking kickoffUtc to the end of the day", () => {
    const m1 = match({
      id: "with-time",
      kickoffUtc: `${DATES.today}T20:00:00`,
    });
    const m2 = match({ id: "no-time", kickoffUtc: null });
    const m3 = match({ id: "early", kickoffUtc: `${DATES.today}T08:00:00` });
    const fav1 = fav({ type: "team", externalId: "h", sport: "Soccer" });
    const env = buildHomeEnvelope([fav1], [m1, m2, m3], DATES);
    expect(env.today.map((m) => m.id)).toEqual([
      "early",
      "with-time",
      "no-time",
    ]);
  });
});
