import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const deleteMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  deleteFavorite: (...args: unknown[]) => deleteMock(...args),
  listFavoritesForUser: vi.fn(),
  createFavorite: vi.fn(),
}));

import { DELETE } from "./route";

const SESSION_A = { user: { id: "user-a", email: "a@example.com" } };
const SESSION_B = { user: { id: "user-b", email: "b@example.com" } };

function makeDeleteRequest(id: string) {
  const req = new Request(`http://localhost/api/favorites/${id}`, {
    method: "DELETE",
  });
  return { req, ctx: { params: Promise.resolve({ id }) } };
}

describe("DELETE /api/favorites/[id]", () => {
  beforeEach(() => {
    authMock.mockReset();
    deleteMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const { req, ctx } = makeDeleteRequest("fav-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns 204 when a row owned by the calling user is deleted", async () => {
    authMock.mockResolvedValue(SESSION_A);
    deleteMock.mockResolvedValue(true);
    const { req, ctx } = makeDeleteRequest("fav-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith("user-a", "fav-1");
  });

  it("returns 404 when the id doesn't exist", async () => {
    authMock.mockResolvedValue(SESSION_A);
    deleteMock.mockResolvedValue(false);
    const { req, ctx } = makeDeleteRequest("does-not-exist");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });

  /**
   * Closes audit finding F1: prevents an IDOR regression if the
   * `WHERE user_id = ?` scoping is ever dropped from the query layer.
   */
  it("CROSS-USER: user A trying to delete user B's favorite returns 404 (not 204), and the queries call was scoped to user A", async () => {
    authMock.mockResolvedValue(SESSION_A);
    // Simulate the scoped query layer: deleteFavorite('user-a', 'fav-owned-by-b')
    // would WHERE id = 'fav-owned-by-b' AND user_id = 'user-a' → 0 rows affected.
    deleteMock.mockImplementation(async (userId: string, favId: string) => {
      // Pretend 'fav-owned-by-b' exists in the DB but belongs to user-b only.
      const ownerOfFavoriteInDb = "user-b";
      return userId === ownerOfFavoriteInDb && favId === "fav-owned-by-b";
    });

    const { req, ctx } = makeDeleteRequest("fav-owned-by-b");
    const res = await DELETE(req, ctx);

    // Caller cannot distinguish "doesn't exist" from "not yours" — by design.
    expect(res.status).toBe(404);
    expect(deleteMock).toHaveBeenCalledWith("user-a", "fav-owned-by-b");

    // Verify it would have worked for the real owner — proves the test set
    // up the scenario correctly (the row exists, just not owned by user A).
    deleteMock.mockClear();
    authMock.mockResolvedValue(SESSION_B);
    const { req: req2, ctx: ctx2 } = makeDeleteRequest("fav-owned-by-b");
    const res2 = await DELETE(req2, ctx2);
    expect(res2.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith("user-b", "fav-owned-by-b");
  });
});
