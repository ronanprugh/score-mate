import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitForTests } from "@/lib/rate-limit";

/* -------------------------------------------------------------------------- */
/* Mocks                                                                       */
/* -------------------------------------------------------------------------- */

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const listMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  listFavoritesForUser: (...args: unknown[]) => listMock(...args),
  createFavorite: (...args: unknown[]) => createMock(...args),
  // deleteFavorite is exercised in the [id]/route.test.ts file.
  deleteFavorite: vi.fn(),
}));

import { GET, POST } from "./route";

/* -------------------------------------------------------------------------- */
/* Test helpers                                                                */
/* -------------------------------------------------------------------------- */

const SESSION = { user: { id: "user-a", email: "a@example.com" } };

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/favorites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  type: "team" as const,
  externalId: "133604",
  displayName: "Arsenal",
  sport: "Soccer" as const,
};

const SAMPLE_ROW = {
  id: "fav-1",
  userId: "user-a",
  type: "team" as const,
  externalId: "133604",
  displayName: "Arsenal",
  sport: "Soccer",
  metadata: null,
  createdAt: new Date("2026-06-22T12:00:00Z"),
};

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe("GET /api/favorites", () => {
  beforeEach(() => {
    authMock.mockReset();
    listMock.mockReset();
    _resetRateLimitForTests();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the calling user's favorites scoped by session.user.id", async () => {
    authMock.mockResolvedValue(SESSION);
    listMock.mockResolvedValue([SAMPLE_ROW]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.favorites).toHaveLength(1);
    expect(body.favorites[0].id).toBe("fav-1");
    expect(listMock).toHaveBeenCalledWith("user-a");
  });
});

describe("POST /api/favorites", () => {
  beforeEach(() => {
    authMock.mockReset();
    createMock.mockReset();
    _resetRateLimitForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makePostRequest(VALID_PAYLOAD) as never);
    expect(res.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a favorite scoped to session.user.id and returns 201", async () => {
    authMock.mockResolvedValue(SESSION);
    createMock.mockResolvedValue({ row: SAMPLE_ROW, existed: false });
    const res = await POST(makePostRequest(VALID_PAYLOAD) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.favorite.id).toBe("fav-1");
    expect(body.existed).toBe(false);
    // Critical: route passed session.user.id, NOT any client-supplied id.
    expect(createMock).toHaveBeenCalledWith("user-a", VALID_PAYLOAD);
  });

  it("duplicate POST returns 200 with existed=true (not a second row)", async () => {
    authMock.mockResolvedValue(SESSION);
    createMock.mockResolvedValue({ row: SAMPLE_ROW, existed: true });
    const res = await POST(makePostRequest(VALID_PAYLOAD) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.existed).toBe(true);
    expect(body.favorite.id).toBe("fav-1");
  });

  it("returns 400 on a malformed payload (unknown type)", async () => {
    authMock.mockResolvedValue(SESSION);
    const res = await POST(
      makePostRequest({ ...VALID_PAYLOAD, type: "player" }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_payload");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed payload (unknown sport)", async () => {
    authMock.mockResolvedValue(SESSION);
    const res = await POST(
      makePostRequest({ ...VALID_PAYLOAD, sport: "Hockey" }) as never,
    );
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON body", async () => {
    authMock.mockResolvedValue(SESSION);
    const req = new Request("http://localhost/api/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_json");
  });

  it("returns 429 after the 61st POST in a 60-second window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T12:00:00Z"));
    authMock.mockResolvedValue(SESSION);
    createMock.mockResolvedValue({ row: SAMPLE_ROW, existed: false });

    for (let i = 0; i < 60; i++) {
      const res = await POST(makePostRequest(VALID_PAYLOAD) as never);
      expect([200, 201]).toContain(res.status);
    }
    const tooMany = await POST(makePostRequest(VALID_PAYLOAD) as never);
    expect(tooMany.status).toBe(429);
    expect(tooMany.headers.get("Retry-After")).toBeTruthy();
    const body = await tooMany.json();
    expect(body.error).toBe("rate_limited");
  });
});
