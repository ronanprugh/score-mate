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

// Replace the client RemoveButton with a marker — its own tests live elsewhere.
vi.mock("@/components/favorite-remove-button", () => ({
  FavoriteRemoveButton: ({
    favoriteId,
    displayName,
  }: {
    favoriteId: string;
    displayName: string;
  }) => (
    <div data-testid={`remove-${favoriteId}`} data-name={displayName}>
      Remove
    </div>
  ),
}));

import MyFavoritesPage from "./page";

const SESSION = { user: { id: "user-a", email: "a@example.com" } };

const ROW = (
  id: string,
  type: "team" | "league" | "sport" | "event",
  name: string,
  sport: string,
) => ({
  id,
  userId: "user-a",
  type,
  externalId: `ext-${id}`,
  displayName: name,
  sport,
  metadata: null,
  createdAt: new Date("2026-06-22T12:00:00Z"),
});

describe("MyFavoritesPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    listMock.mockReset();
    authMock.mockResolvedValue(SESSION);
  });

  it("renders the empty state with a link to /favorites when the user has zero favorites", async () => {
    listMock.mockResolvedValue([]);
    render(await MyFavoritesPage());
    expect(
      screen.getByRole("heading", { name: /my favorites/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/haven't favorited anything yet/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /favorites/i });
    expect(link).toHaveAttribute("href", "/favorites");
  });

  it("renders one section per favorite type (Teams / Leagues / Sports / Tournaments) when the user has one of each", async () => {
    listMock.mockResolvedValue([
      ROW("1", "team", "Arsenal", "Soccer"),
      ROW("2", "league", "Premier League", "Soccer"),
      ROW("3", "sport", "Soccer (top matches)", "Soccer"),
      ROW("4", "event", "FIFA World Cup 2026", "Soccer"),
    ]);
    render(await MyFavoritesPage());

    expect(
      screen.getByRole("heading", { name: /^Teams$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Leagues$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Sports$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Tournaments$/ }),
    ).toBeInTheDocument();

    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(screen.getByText("Premier League")).toBeInTheDocument();
    expect(screen.getByText("FIFA World Cup 2026")).toBeInTheDocument();

    // Remove button rendered for every row.
    expect(screen.getByTestId("remove-1")).toBeInTheDocument();
    expect(screen.getByTestId("remove-2")).toBeInTheDocument();
    expect(screen.getByTestId("remove-3")).toBeInTheDocument();
    expect(screen.getByTestId("remove-4")).toBeInTheDocument();

    expect(listMock).toHaveBeenCalledWith("user-a");
  });

  it("scopes the query to session.user.id (not a client-supplied id)", async () => {
    listMock.mockResolvedValue([]);
    await MyFavoritesPage();
    expect(listMock).toHaveBeenCalledWith("user-a");
  });

  it("renders nothing (null) when there's no session — layout should have redirected", async () => {
    authMock.mockResolvedValue(null);
    const ui = await MyFavoritesPage();
    expect(ui).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });
});
