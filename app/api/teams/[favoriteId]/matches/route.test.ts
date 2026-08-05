import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Match } from "@/lib/sports/types";
import type { EntityMatchesEnvelope } from "@/lib/teams/types";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const listFavoritesMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  listFavoritesForUser: (userId: string) => listFavoritesMock(userId),
}));

const findCatalogTeamByIdMock = vi.fn();
vi.mock("@/lib/espn/catalog", () => ({
  findCatalogTeamById: (id: string, sport?: string, displayName?: string) =>
    findCatalogTeamByIdMock(id, sport, displayName),
}));

const athleteMatchHistoryMock = vi.fn();
vi.mock("@/lib/espn/client", () => ({
  athleteMatchHistory: (leagueKey: string, athleteId: string) =>
    athleteMatchHistoryMock(leagueKey, athleteId),
}));

/**
 * As of Spec 13 the route fans out across competitions via
 * `teamScheduleAcrossCompetitions` rather than calling
 * `teamScheduleForLeague` directly, so the mock lives here. `teamScheduleMock`
 * keeps its old name and `(leagueKey, teamId)` signature so existing cases
 * read unchanged; it now stands for the merged multi-competition result.
 */
const teamScheduleMock = vi.fn();
/** Per-competition failures the fan-out settled with; empty unless a test sets them. */
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
    externalId: "3623",
    displayName: "Jannik Sinner",
    sport: "Tennis",
    metadata: { leagueKey: "tennis/atp" },
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

function ctx(favoriteId: string) {
  return { params: Promise.resolve({ favoriteId }) };
}

describe("GET /api/teams/[favoriteId]/matches", () => {
  beforeEach(() => {
    authMock.mockReset();
    listFavoritesMock.mockReset();
    findCatalogTeamByIdMock.mockReset();
    teamScheduleMock.mockReset();
    athleteMatchHistoryMock.mockReset();
    fanoutErrorsMock.mockReset();
    fanoutErrorsMock.mockReturnValue([]);
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new Request("http://x"), ctx("fav-1"));
    expect(res.status).toBe(401);
    expect(listFavoritesMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the favoriteId doesn't belong to the user", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite({ id: "fav-other" })]);
    const res = await GET(new Request("http://x"), ctx("fav-missing"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-team/player favorite (e.g. league)", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([
      teamFavorite({ id: "fav-1", type: "league" }),
    ]);
    const res = await GET(new Request("http://x"), ctx("fav-1"));
    expect(res.status).toBe(404);
  });

  it("returns full Match[] capped at 10 recent + 10 upcoming for a team favorite", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite()]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "133602",
      name: "Arsenal",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
      badgeUrl: "https://example.com/arsenal.png",
    });

    const finals = Array.from({ length: 15 }, (_, i) =>
      makeMatch({
        id: `final-${i}`,
        status: "final",
        homeScore: 2,
        awayScore: 1,
        dateUtc: `2026-01-${String(i + 1).padStart(2, "0")}`,
        kickoffUtc: `2026-01-${String(i + 1).padStart(2, "0")}T15:00:00Z`,
      }),
    );
    const upcomings = Array.from({ length: 15 }, (_, i) =>
      makeMatch({
        id: `next-${i}`,
        status: "upcoming",
        dateUtc: `2026-08-${String(i + 1).padStart(2, "0")}`,
        kickoffUtc: `2026-08-${String(i + 1).padStart(2, "0")}T15:00:00Z`,
      }),
    );
    teamScheduleMock.mockResolvedValue([...finals, ...upcomings]);

    const res = await GET(new Request("http://x"), ctx("fav-1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as EntityMatchesEnvelope;

    expect(body.entity).toMatchObject({
      favoriteId: "fav-1",
      displayName: "Arsenal",
      type: "team",
      badgeUrl: "https://example.com/arsenal.png",
    });
    expect(body.recent).toHaveLength(10);
    expect(body.upcoming).toHaveLength(10);
    // Most-recent-first: the 15th final (Jan 15) should be first.
    expect(body.recent[0]!.id).toBe("final-14");
    // Soonest-first: the 1st upcoming (Aug 1) should be first.
    expect(body.upcoming[0]!.id).toBe("next-0");
    expect(body.source.ok).toBe(true);
    expect(teamScheduleMock).toHaveBeenCalledWith("soccer/eng.1", "133602");
  });

  it("returns fewer than 10 when the schedule has fewer matches", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite()]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "133602",
      name: "Arsenal",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
    });
    teamScheduleMock.mockResolvedValue([
      makeMatch({ id: "final-1", status: "final" }),
    ]);

    const res = await GET(new Request("http://x"), ctx("fav-1"));
    const body = (await res.json()) as EntityMatchesEnvelope;
    expect(body.recent).toHaveLength(1);
    expect(body.upcoming).toHaveLength(0);
  });

  it("returns 200 with source.ok=false and empty arrays when the team is not in the catalog", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([
      teamFavorite({ externalId: "unknown-id" }),
    ]);
    findCatalogTeamByIdMock.mockReturnValue(null);

    const res = await GET(new Request("http://x"), ctx("fav-1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as EntityMatchesEnvelope;
    expect(body.recent).toEqual([]);
    expect(body.upcoming).toEqual([]);
    expect(body.source.ok).toBe(false);
    expect(teamScheduleMock).not.toHaveBeenCalled();
  });

  it("returns 200 with source.ok=false when the schedule fetch throws", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite()]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "133602",
      name: "Arsenal",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
    });
    teamScheduleMock.mockRejectedValue(new Error("ESPN 500"));

    const res = await GET(new Request("http://x"), ctx("fav-1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as EntityMatchesEnvelope;
    expect(body.source.ok).toBe(false);
    expect(body.source.errors).toContain("ESPN 500");
  });

  it("surfaces a friendly from a companion league, matching /api/teams coverage", async () => {
    // Spec 13, Unit 2: the two Teams screens must agree about which matches
    // exist. A preseason friendly is the case that used to be invisible here.
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
        id: "league-1",
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

    const res = await GET(new Request("http://x"), ctx("fav-1"));
    const body = (await res.json()) as EntityMatchesEnvelope;

    expect(body.recent.map((m) => m.id)).toEqual([
      "friendly-leeds",
      "league-1",
    ]);
    expect(body.recent[0]?.leagueName).toBe("Club Friendly");
    expect(body.source.ok).toBe(true);
  });

  it("reports a partial competition failure without dropping the other competitions", async () => {
    // The realistic failure shape: the fan-out helper settles rather than
    // rejecting, so it returns matches AND errors together.
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([teamFavorite()]);
    findCatalogTeamByIdMock.mockReturnValue({
      id: "133602",
      name: "Arsenal",
      sport: "Soccer",
      leagueKey: "soccer/eng.1",
    });
    fanoutErrorsMock.mockReturnValue([
      "Schedule fetch failed for soccer/uefa.europa: ESPN 503",
    ]);
    teamScheduleMock.mockResolvedValue([
      makeMatch({ id: "final-1", status: "final" }),
    ]);

    const res = await GET(new Request("http://x"), ctx("fav-1"));
    const body = (await res.json()) as EntityMatchesEnvelope;

    expect(res.status).toBe(200);
    expect(body.recent).toHaveLength(1);
    expect(body.source.ok).toBe(false);
    expect(body.source.errors[0]).toContain("uefa.europa");
  });

  it("returns full Match[] for a player favorite via athleteMatchHistory, using the stored leagueKey", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([playerFavorite()]);
    const recent = [
      makeMatch({ id: "sinner-1", status: "final", sport: "Tennis" }),
    ];
    const upcoming = [
      makeMatch({ id: "sinner-2", status: "upcoming", sport: "Tennis" }),
    ];
    athleteMatchHistoryMock.mockResolvedValue({ recent, upcoming });

    const res = await GET(new Request("http://x"), ctx("fav-p1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as EntityMatchesEnvelope;

    expect(body.entity).toMatchObject({
      favoriteId: "fav-p1",
      displayName: "Jannik Sinner",
      type: "player",
      sport: "Tennis",
    });
    expect(body.recent).toEqual(recent);
    expect(body.upcoming).toEqual(upcoming);
    expect(body.source.ok).toBe(true);
    expect(athleteMatchHistoryMock).toHaveBeenCalledWith("tennis/atp", "3623");
  });

  it("falls back to the sport's primary league key when the player has no stored leagueKey", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([
      playerFavorite({
        id: "fav-p2",
        externalId: "1966",
        displayName: "LeBron James",
        sport: "Basketball",
        metadata: null,
      }),
    ]);
    athleteMatchHistoryMock.mockResolvedValue({ recent: [], upcoming: [] });

    await GET(new Request("http://x"), ctx("fav-p2"));
    expect(athleteMatchHistoryMock).toHaveBeenCalledWith(
      "basketball/nba",
      "1966",
    );
  });

  it("returns 200 with empty arrays (Match data unavailable) when the player has no ESPN data", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([playerFavorite()]);
    athleteMatchHistoryMock.mockResolvedValue({ recent: [], upcoming: [] });

    const res = await GET(new Request("http://x"), ctx("fav-p1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as EntityMatchesEnvelope;
    expect(body.recent).toEqual([]);
    expect(body.upcoming).toEqual([]);
    expect(body.source.ok).toBe(true);
  });

  it("includes a Server-Timing header on a 200 response", async () => {
    authMock.mockResolvedValue(SESSION);
    listFavoritesMock.mockResolvedValue([playerFavorite()]);
    athleteMatchHistoryMock.mockResolvedValue({ recent: [], upcoming: [] });

    const res = await GET(new Request("http://x"), ctx("fav-p1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Server-Timing")).toMatch(/^teams-matches;dur=\d+/);
  });
});
