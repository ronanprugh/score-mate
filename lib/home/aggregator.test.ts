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
function fetcherFrom(
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

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe("aggregateMatchesForUser", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("returns an empty envelope (ok=true, no errors) for a user with zero favorites", async () => {
    listMock.mockResolvedValue([]);
    const fetcher = vi.fn<EventsDayFetcher>(async () => []);
    const env = await aggregateMatchesForUser("user-a", DATES, fetcher);
    expect(env).toEqual({
      yesterday: [],
      today: [],
      tomorrow: [],
      source: { ok: true, errors: [] },
    });
    expect(fetcher).not.toHaveBeenCalled();
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
    const fetcher = vi.fn<EventsDayFetcher>(async () => []);
    await aggregateMatchesForUser("user-a", DATES, fetcher);
    // 2 sports × 3 dates = 6 calls; no extras for sports not in favorites.
    expect(fetcher).toHaveBeenCalledTimes(6);
    const callSports = new Set<Sport>(fetcher.mock.calls.map((c) => c[1]));
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
    const fetcher = fetcherFrom({
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

    const env = await aggregateMatchesForUser("user-a", DATES, fetcher);
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
    const fetcher = fetcherFrom({
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
    const env = await aggregateMatchesForUser("user-a", DATES, fetcher);
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
    const fetcher = fetcherFrom({
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

    const env = await aggregateMatchesForUser("user-a", DATES, fetcher);
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
    const fetcher = fetcherFrom({
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
    const env = await aggregateMatchesForUser("user-a", DATES, fetcher);
    expect(env.yesterday).toEqual([]);
    expect(env.today).toEqual([]);
    expect(env.tomorrow).toEqual([]);
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
