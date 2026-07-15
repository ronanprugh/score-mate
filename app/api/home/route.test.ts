import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const aggregateMock = vi.fn();
// Mock without `importActual` — the real aggregator module imports
// `lib/favorites/queries.ts` which imports `db/index.ts`, and `db/index.ts`
// throws at module load when DATABASE_URL is unset (CI test step doesn't
// set one). The route handler only calls `aggregateMatchesForUser`, so
// stubbing the other exports as no-ops is enough.
vi.mock("@/lib/home/aggregator", () => ({
  aggregateMatchesForUser: (...args: unknown[]) => aggregateMock(...args),
  buildHomeEnvelope: vi.fn(),
}));

// The cache layer is exercised in integration only; here we stub the
// fetchers bundle so the route test stays a pure unit test.
vi.mock("@/lib/home/cache", () => ({
  makeCachedFetchers: () => ({
    eventsLeagueDay: async () => [],
    activeTennisTournaments: async () => [],
  }),
}));

import { GET } from "./route";

const SESSION = { user: { id: "user-a", email: "a@example.com" } };

function makeRequest(query: string) {
  return new Request(`http://localhost/api/home${query}`, { method: "GET" });
}

const EMPTY_ENVELOPE = {
  yesterday: [],
  today: [],
  tomorrow: [],
  activeTennisTournaments: { yesterday: [], today: [], tomorrow: [] },
  source: { ok: true, errors: [] },
};

describe("GET /api/home", () => {
  beforeEach(() => {
    authMock.mockReset();
    aggregateMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(
      makeRequest("?dates=2026-06-21,2026-06-22,2026-06-23") as never,
    );
    expect(res.status).toBe(401);
    expect(aggregateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when `dates` is missing", async () => {
    authMock.mockResolvedValue(SESSION);
    const res = await GET(makeRequest("") as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_dates");
  });

  it("returns 400 when `dates` is malformed (wrong format)", async () => {
    authMock.mockResolvedValue(SESSION);
    const res = await GET(
      makeRequest(
        "?dates=06%2F21%2F2026,06%2F22%2F2026,06%2F23%2F2026",
      ) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when `dates` has the wrong number of parts", async () => {
    authMock.mockResolvedValue(SESSION);
    const res = await GET(makeRequest("?dates=2026-06-22") as never);
    expect(res.status).toBe(400);
  });

  it("returns 200 + empty envelope for a user with no favorites", async () => {
    authMock.mockResolvedValue(SESSION);
    aggregateMock.mockResolvedValue(EMPTY_ENVELOPE);
    const res = await GET(
      makeRequest("?dates=2026-06-21,2026-06-22,2026-06-23") as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(EMPTY_ENVELOPE);
    // Aggregator received the user's id + the parsed dates + out-param.
    expect(aggregateMock).toHaveBeenCalledWith(
      "user-a",
      { yesterday: "2026-06-21", today: "2026-06-22", tomorrow: "2026-06-23" },
      expect.objectContaining({
        eventsLeagueDay: expect.any(Function),
      }),
      expect.any(String),
      expect.any(Object),
    );
  });

  it("includes a Server-Timing header and passes the JSON body through unchanged", async () => {
    authMock.mockResolvedValue(SESSION);
    aggregateMock.mockResolvedValue(EMPTY_ENVELOPE);
    const res = await GET(
      makeRequest("?dates=2026-06-21,2026-06-22,2026-06-23") as never,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Server-Timing")).toMatch(/^home;dur=\d+/);
    const body = await res.json();
    expect(body).toEqual(EMPTY_ENVELOPE);
  });

  it("returns 200 with source.ok=false (partial failure) and still passes data through", async () => {
    authMock.mockResolvedValue(SESSION);
    aggregateMock.mockResolvedValue({
      yesterday: [],
      today: [
        {
          id: "m1",
          sport: "Soccer",
          homeTeamId: "h",
          homeTeamName: "Home",
          awayTeamId: "a",
          awayTeamName: "Away",
          leagueId: "0",
          leagueName: "L",
          dateUtc: "2026-06-22",
          kickoffUtc: "2026-06-22T15:00:00",
          status: "live",
        },
      ],
      tomorrow: [],
      source: { ok: false, errors: ["TheSportsDB 503 for Basketball"] },
    });
    const res = await GET(
      makeRequest("?dates=2026-06-21,2026-06-22,2026-06-23") as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source.ok).toBe(false);
    expect(body.source.errors).toHaveLength(1);
    expect(body.today).toHaveLength(1);
    expect(body.today[0].id).toBe("m1");
  });
});
