import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const listMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  listFavoritesForUser: (...args: unknown[]) => listMock(...args),
  createFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
}));

// FavoritesSearch is fully tested elsewhere; mock to confirm props.
vi.mock("@/components/favorites-search", () => ({
  FavoritesSearch: ({
    initialFavorites,
  }: {
    initialFavorites: Array<{ type: string; externalId: string }>;
  }) => (
    <div
      data-testid="favorites-search"
      data-initial-count={initialFavorites.length}
      data-initial-keys={initialFavorites
        .map((f) => `${f.type}:${f.externalId}`)
        .join(",")}
    >
      FavoritesSearch
    </div>
  ),
}));

import FavoritesPage from "./page";

const SESSION = { user: { id: "user-a", email: "a@example.com" } };

const ROW = (
  id: string,
  type: "team" | "league" | "sport" | "event",
  externalId: string,
) => ({
  id,
  userId: "user-a",
  type,
  externalId,
  displayName: `Name ${id}`,
  sport: "Soccer",
  metadata: null,
  createdAt: new Date(),
});

describe("FavoritesPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    listMock.mockReset();
    authMock.mockResolvedValue(SESSION);
  });

  it("renders the page header and the search component", async () => {
    listMock.mockResolvedValue([]);
    render(await FavoritesPage());
    expect(
      screen.getByRole("heading", { name: /add a favorite/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("favorites-search")).toBeInTheDocument();
  });

  it("passes the user's existing favorites as initial keys to FavoritesSearch", async () => {
    listMock.mockResolvedValue([
      ROW("1", "team", "133604"),
      ROW("2", "league", "4328"),
      ROW("3", "sport", "Soccer"),
    ]);
    render(await FavoritesPage());
    const el = screen.getByTestId("favorites-search");
    expect(el).toHaveAttribute("data-initial-count", "3");
    expect(el).toHaveAttribute(
      "data-initial-keys",
      "team:133604,league:4328,sport:Soccer",
    );
  });

  it("scopes the existing-favorites query to session.user.id", async () => {
    listMock.mockResolvedValue([]);
    await FavoritesPage();
    expect(listMock).toHaveBeenCalledWith("user-a");
  });

  it("returns null when there's no session — layout should have redirected", async () => {
    authMock.mockResolvedValue(null);
    const ui = await FavoritesPage();
    expect(ui).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });
});
