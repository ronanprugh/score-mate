import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Match } from "@/lib/sports/types";
import type { TeamsEnvelope } from "@/lib/teams/types";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

// `lib/favorites/queries` imports `db/index.ts`, which throws at load when
// DATABASE_URL is unset (CI test step). Stub the one export the route uses.
const listFavoritesMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  listFavoritesForUser: (userId: string) => listFavoritesMock(userId),
}));

const findCatalogTeamByIdMock = vi.fn();
vi.mock("@/lib/espn/catalog", () => ({
  findCatalogTeamById: (id: string, sport?: string, displayName?: string) =>
    findCatalogTeamByIdMock(id, sport, displayName),
}));

const athleteScheduleMock = vi.fn();
vi.mock("@/lib/espn/client", () => ({
  athleteSchedule: (leagueKey: string, athleteId: string) =>
    athleteScheduleMock(leagueKey, athleteId),
}));

/**
 * As of Spec 13 the route fans out across competitions rather than calling
 * `teamScheduleForLeague` directly. `teamScheduleMock` keeps its old name and
 * signature so existing cases read unchanged; it now stands for the merged
 * multi-competition result. `fanoutErrorsMock` covers the realistic
 * partial-failure shape, where the helper settles and returns errors
 * alongside matches instead of rejecting.
 */
const teamScheduleMock = vi.fn();
const fanoutErrorsMock = vi.fn<() => string[]>(() => []);
vi.mock("@/lib/teams/schedule", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/teams/schedule")>();
  return {
    ...actual,
    teamScheduleAcrossCompetitions: async (
      primaryLeagueKey: string,
      teamId: string,
    ) => ({
      matches: await teamScheduleMock(primaryLeagueKey, teamId),
      errors: fanoutErrorsMock(),
    }),
  };
});

// unstable_cache requires the Next.js incremental cache context which is
// absent in the Vitest jsdom environment. Stub it as a transparent passthrough
// so the route's caching layer doesn't interfere with unit-test assertions.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

import { GET } from "./route";

const SESSION = { user: { id: "user-a", email: "a@example.com" } };

function teamFavorite(over: Record<string, unknown> = {}) {
  return {
    id: "fav-1",
    userId: "user-a",
    type: "team",
    externalId: "133602",
    displayName: "Arsenal",
    sport: "Soccer",
    metadata: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    ...over,
  };
}

function playerFavorite(over: Record<string, unknown> = {}) {
  return {
    id: "fav-p1",
    userId: "user-a",
    type: "player",
    externalId: "1966",
    displayName: "LeBron James",
    sport: "Basketball",
    metadata: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    ...over,
  };
}

function makeMatch(over: Partial<Match>): Match {
  return {
    id: over.id ?? "evt",
    sport: "Soccer",
    homeTeamId: over.homeTeamId ?? "133602",
    homeTeamName: over.homeTeamName ?? "Arsenal",
    awayTeamId: over.awayTeamId ?? "999",
    awayTeamName: over.awayTeamName ?? "Chelsea",
    leagueId: "soccer/eng.1",
    leagueName: over.leagueName ?? "English Premier League",
    dateUtc: over.dateUtc ?? "2026-06-24",
    kickoffUtc: over.kickoffUtc ?? "2026-06-24T19:30:00Z",
    status: over.status ?? "upcoming",
    ...over,
  };
}

describe("GET /api/teams", () => {
  beforeEach(() => {
    authMock.mockReset();
    listFavoritesMock.mockReset();
    findCatalogTeamByIdMock.mockReset();
    teamScheduleMock.mockReset();
    athleteScheduleMock.mockReset();
    fanoutErrorsMock.mockReset();
    fanoutErrorsMock.mockReturnValue([]);
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listFavoritesMock).not.toHaveBeenCalled();
  });

  it("returns lastMatch (with score) and nextMatch (with kickoff) for a team favorite", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite()]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "133602",
      name: "Arsenal",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
      badgeUrl: "https://example.com/arsenal.png",
    });
    teamScheduleMock.mockResolvedValue([
      makeMatch({
        id: "final-1",
        status: "final",
        homeScore: 2,
        awayScore: 1,
        awayTeamName: "Chelsea",
        kickoffUtc: "2026-06-20T15:00:00Z",
        dateUtc: "2026-06-20",
      }),
      makeMatch({
        id: "next-1",
        status: "upcoming",
        awayTeamName: "Spurs",
        kickoffUtc: "2026-06-28T14:00:00Z",
        dateUtc: "2026-06-28",
      }),
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as TeamsEnvelope;

    expect(body.entities).toHaveLength(1);
    const entity = body.entities[0]!;
    expect(entity).toMatchObject({
      favoriteId: "fav-1",
      displayName: "Arsenal",
      type: "team",
      sport: "Soccer",
      badgeUrl: "https://example.com/arsenal.png",
    });
    expect(entity.lastMatch).toMatchObject({
      opponentName: "Chelsea",
      score: "2-1",
      leagueName: "English Premier League",
    });
    expect(entity.nextMatch).toMatchObject({
      opponentName: "Spurs",
      kickoffUtc: "2026-06-28T14:00:00Z",
    });
    expect(entity.nextMatch?.score).toBeUndefined();
    expect(body.source.ok).toBe(true);
    expect(teamScheduleMock).toHaveBeenCalledWith("soccer/eng.1", "133602");
    // The catalog lookup is disambiguated by sport + name (ESPN ids collide).
    expect(findCatalogTeamByIdMock).toHaveBeenCalledWith(
      "133602",
      "Soccer",
      "Arsenal",
    );
  });

  it("returns a null-match entity and source.ok=false when the team is not in the catalog", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([
      teamFavorite({ externalId: "unknown-id", displayName: "Mystery FC" }),
    ]);
    findCatalogTeamByIdMock.mockReturnValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as TeamsEnvelope;

    expect(body.entities).toHaveLength(1);
    expect(body.entities[0]).toMatchObject({
      displayName: "Mystery FC",
      lastMatch: null,
      nextMatch: null,
    });
    expect(body.source.ok).toBe(false);
    expect(body.source.errors.length).toBeGreaterThan(0);
    expect(teamScheduleMock).not.toHaveBeenCalled();
  });

  it("records an error and returns null matches when the schedule fetch throws", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite()]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "133602",
      name: "Arsenal",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
    });
    teamScheduleMock.mockRejectedValue(new Error("ESPN 500"));

    const res = await GET();
    const body = (await res.json()) as TeamsEnvelope;
    expect(body.entities[0]).toMatchObject({
      lastMatch: null,
      nextMatch: null,
    });
    expect(body.source.ok).toBe(false);
    expect(body.source.errors).toContain("ESPN 500");
  });

  it("selects a friendly as the last match when it is the most recent fixture", async () => {
    // Spec 13, Unit 2 / Q6 (A): chronology wins — no preference for
    // competitive matches. In preseason the friendly is the news.
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([
      teamFavorite({ externalId: "364", displayName: "Liverpool" }),
    ]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "364",
      name: "Liverpool",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
    });
    teamScheduleMock.mockResolvedValue([
      makeMatch({
        id: "league-final",
        status: "final",
        kickoffUtc: "2026-05-24T15:00Z",
        leagueName: "Premier League",
      }),
      makeMatch({
        id: "friendly-leeds",
        status: "final",
        kickoffUtc: "2026-08-02T20:00Z",
        leagueName: "Club Friendly",
      }),
    ]);

    const res = await GET();
    const body = (await res.json()) as TeamsEnvelope;

    expect(body.entities[0]?.lastMatch).toMatchObject({
      leagueName: "Club Friendly",
    });
    expect(body.source.ok).toBe(true);
  });

  it("reports a partial competition failure while keeping the matches that resolved", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite()]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "133602",
      name: "Arsenal",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
    });
    fanoutErrorsMock.mockReturnValue([
      "Schedule fetch failed for soccer/uefa.champions: ESPN 503",
    ]);
    teamScheduleMock.mockResolvedValue([
      makeMatch({ id: "league-final", status: "final" }),
    ]);

    const res = await GET();
    const body = (await res.json()) as TeamsEnvelope;

    expect(body.entities[0]?.lastMatch).not.toBeNull();
    expect(body.source.ok).toBe(false);
    expect(body.source.errors[0]).toContain("uefa.champions");
  });

  it("returns last/next matches for a player favorite when athleteSchedule resolves", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([playerFavorite()]);
    athleteScheduleMock.mockResolvedValue({
      lastMatch: {
        opponentName: "Houston Rockets",
        date: "2026-03-17",
        kickoffUtc: "2026-03-17T01:30:00Z",
        leagueName: "NBA",
      },
      nextMatch: {
        opponentName: "Boston Celtics",
        date: "2026-03-20",
        kickoffUtc: "2026-03-20T00:00:00Z",
        leagueName: "NBA",
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as TeamsEnvelope;

    expect(body.entities).toHaveLength(1);
    const entity = body.entities[0]!;
    expect(entity).toMatchObject({
      favoriteId: "fav-p1",
      displayName: "LeBron James",
      type: "player",
      sport: "Basketball",
    });
    expect(entity.lastMatch).toMatchObject({ opponentName: "Houston Rockets" });
    expect(entity.nextMatch).toMatchObject({ opponentName: "Boston Celtics" });
    expect(body.source.ok).toBe(true);
    // With no stored leagueKey, the lookup falls back to the sport's primary
    // league key (basketball/nba).
    expect(athleteScheduleMock).toHaveBeenCalledWith("basketball/nba", "1966");
  });

  it("uses the player's stored leagueKey metadata when present (e.g. soccer/usa.1)", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([
      playerFavorite({
        externalId: "45843",
        displayName: "Lionel Messi",
        sport: "Soccer",
        metadata: { leagueKey: "soccer/usa.1" },
      }),
    ]);
    athleteScheduleMock.mockResolvedValue({ lastMatch: null, nextMatch: null });

    await GET();
    // The athlete's actual league is used, not Soccer's primary (soccer/eng.1).
    expect(athleteScheduleMock).toHaveBeenCalledWith("soccer/usa.1", "45843");
  });

  it("returns a null-match player entity and source.ok=false when athleteSchedule throws", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([playerFavorite()]);
    athleteScheduleMock.mockRejectedValue(new Error("ESPN athlete 500"));

    const res = await GET();
    const body = (await res.json()) as TeamsEnvelope;

    expect(body.entities[0]).toMatchObject({
      type: "player",
      lastMatch: null,
      nextMatch: null,
    });
    expect(body.source.ok).toBe(false);
    expect(body.source.errors).toContain("ESPN athlete 500");
  });

  it("includes a Server-Timing header on a successful response", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Server-Timing")).toMatch(/^teams;dur=\d+/);
  });
});
