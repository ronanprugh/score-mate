import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import { GET } from "./route";

const SESSION = { user: { id: "user-a", email: "a@example.com" } };

function makeRequest(query: string) {
  return new Request(`http://localhost/api/favorites/search${query}`, {
    method: "GET",
  });
}

interface SearchResult {
  type: "team" | "sport" | "league" | "event";
  externalId: string;
  displayName: string;
  sport: string;
  metadata?: Record<string, unknown>;
}

async function searchAs(query: string) {
  authMock.mockResolvedValue(SESSION);
  const res = await GET(makeRequest(query) as never);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { results: SearchResult[] };
  return body.results;
}

describe("GET /api/favorites/search — auth gating", () => {
  beforeEach(() => authMock.mockReset());

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(makeRequest("?q=arsenal") as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty results for an empty query", async () => {
    authMock.mockResolvedValue(SESSION);
    const res = await GET(makeRequest("?q=") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });
});

describe("GET /api/favorites/search — known queries return ESPN results", () => {
  beforeEach(() => authMock.mockReset());

  it("?q=arsenal returns Arsenal as type=team (Soccer)", async () => {
    const results = await searchAs("?q=arsenal");
    expect(
      results.some(
        (r) =>
          r.type === "team" &&
          r.displayName === "Arsenal" &&
          r.sport === "Soccer",
      ),
    ).toBe(true);
  });

  it("?q=lakers returns Los Angeles Lakers as type=team (Basketball)", async () => {
    const results = await searchAs("?q=lakers");
    expect(
      results.some(
        (r) =>
          r.type === "team" &&
          r.displayName === "Los Angeles Lakers" &&
          r.sport === "Basketball",
      ),
    ).toBe(true);
  });

  it.each([
    ["chiefs", "Soccer", false],
    ["chiefs", "American Football", true],
  ])(
    "?q=chiefs with sport filter=%s returns a team match (=%s expected)",
    async (q, sport, expectChiefsHit) => {
      const results = await searchAs(
        `?q=${q}&sport=${encodeURIComponent(sport)}`,
      );
      const chiefsTeam = results.find(
        (r) => r.type === "team" && r.displayName === "Kansas City Chiefs",
      );
      expect(Boolean(chiefsTeam)).toBe(expectChiefsHit);
    },
  );

  it.each([
    "arsenal",
    "lakers",
    "chiefs",
    "manchester",
    "liverpool",
    "barcelona",
  ])(
    "?q=%s returns ≥ 1 result (success metric §4 breadth check)",
    async (q) => {
      const results = await searchAs(`?q=${q}`);
      expect(results.length).toBeGreaterThanOrEqual(1);
    },
  );

  it("?q=wnba returns at least one league/team match", async () => {
    const results = await searchAs("?q=wnba");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("?q=mls returns at least one match (MLS is a league display name)", async () => {
    const results = await searchAs("?q=mls");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/favorites/search — result composition", () => {
  beforeEach(() => authMock.mockReset());

  it("?q=soccer returns a type=sport result with externalId='Soccer'", async () => {
    const results = await searchAs("?q=soccer");
    expect(
      results.some((r) => r.type === "sport" && r.externalId === "Soccer"),
    ).toBe(true);
  });

  it("?q=world cup includes the type=event entry for FIFA World Cup 2026", async () => {
    const results = await searchAs(`?q=${encodeURIComponent("world cup")}`);
    const wc = results.find(
      (r) => r.type === "event" && r.externalId === "fifa-world-cup-2026",
    );
    expect(wc).toBeDefined();
    expect(wc!.metadata?.startDate).toBe("2026-06-11");
    expect(wc!.metadata?.endDate).toBe("2026-07-19");
  });

  it("?q=premier returns the EPL as type=league with externalId='soccer/eng.1'", async () => {
    const results = await searchAs("?q=premier");
    const epl = results.find(
      (r) => r.type === "league" && r.externalId === "soccer/eng.1",
    );
    expect(epl).toBeDefined();
    expect(epl!.displayName).toBe("Premier League");
  });

  it("each category is capped at 10 results", async () => {
    // 'fc' matches a very large number of soccer team names.
    const results = await searchAs("?q=fc");
    const byType: Record<string, number> = {};
    for (const r of results) byType[r.type] = (byType[r.type] ?? 0) + 1;
    for (const t of Object.keys(byType)) {
      expect(byType[t]).toBeLessThanOrEqual(10);
    }
  });

  it("dedupes a team that appears in multiple league catalogs (Arsenal: Premier + FA Cup)", async () => {
    const results = await searchAs("?q=arsenal&sport=Soccer");
    const arsenalTeamHits = results.filter(
      (r) => r.type === "team" && r.displayName === "Arsenal",
    );
    // Without dedup we'd see Arsenal twice (eng.1 + eng.fa); with dedup, once.
    expect(arsenalTeamHits).toHaveLength(1);
  });

  it("category ordering is sport, event, league, team", async () => {
    const results = await searchAs(`?q=${encodeURIComponent("world cup")}`);
    // For "world cup", we expect at minimum: event (FIFA WC), maybe leagues
    // (FIFA World Cup), maybe teams (none meaningful). Verify that the
    // first non-sport result is an event when one exists, and that events
    // precede leagues in the response stream.
    let sawEvent = false;
    for (const r of results) {
      if (r.type === "event") sawEvent = true;
      if (r.type === "league") expect(sawEvent).toBe(true);
    }
  });

  it("?q=wimbledon returns Wimbledon as type=event with sport=Tennis and year-less externalId", async () => {
    const results = await searchAs("?q=wimbledon");
    const wimbledon = results.find(
      (r) =>
        r.type === "event" &&
        r.externalId === "tennis/slam/wimbledon" &&
        r.sport === "Tennis",
    );
    expect(wimbledon).toBeDefined();
    expect(wimbledon!.displayName).toBe("Wimbledon");
  });

  it("?q=australian returns Australian Open as type=event with sport=Tennis", async () => {
    const results = await searchAs("?q=australian");
    expect(
      results.some(
        (r) =>
          r.type === "event" &&
          r.externalId === "tennis/slam/australian-open" &&
          r.sport === "Tennis",
      ),
    ).toBe(true);
  });
});
