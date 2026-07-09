import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

class RedirectError extends Error {
  constructor(public readonly path: string) {
    super(`__REDIRECT__:${path}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new RedirectError(path);
  },
}));

vi.mock("@/components/entity-matches-client", () => ({
  EntityMatchesClient: ({ favoriteId }: { favoriteId: string }) => (
    <div data-testid="entity-matches-client">{favoriteId}</div>
  ),
}));

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const listFavoritesMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  listFavoritesForUser: (userId: string) => listFavoritesMock(userId),
}));

import EntityDetailPage from "./page";

function makeParams(favoriteId: string) {
  return { params: Promise.resolve({ favoriteId }) };
}

describe("Entity detail page (server shell)", () => {
  beforeEach(() => {
    authMock.mockReset();
    listFavoritesMock.mockReset();
  });

  it("redirects to /signin when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(EntityDetailPage(makeParams("fav-1"))).rejects.toThrow(
      /__REDIRECT__:\/signin/,
    );
  });

  it("renders a not-found state when the favoriteId doesn't belong to the user", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([
      {
        id: "fav-other",
        type: "team",
        externalId: "1",
        displayName: "Arsenal",
        sport: "Soccer",
      },
    ]);
    const ui = await EntityDetailPage(makeParams("fav-missing"));
    render(ui);

    expect(screen.getByText("Not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to teams/i });
    expect(link).toHaveAttribute("href", "/teams");
    expect(
      screen.queryByTestId("entity-matches-client"),
    ).not.toBeInTheDocument();
  });

  it("renders a not-found state for a non-team/player favorite (e.g. league)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([
      {
        id: "fav-1",
        type: "league",
        externalId: "eng.1",
        displayName: "EPL",
        sport: "Soccer",
      },
    ]);
    const ui = await EntityDetailPage(makeParams("fav-1"));
    render(ui);

    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it("renders the header (name + badge) and the matches client for a valid team favorite", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([
      {
        id: "fav-1",
        type: "team",
        externalId: "133602",
        displayName: "Arsenal",
        sport: "Soccer",
      },
    ]);
    const ui = await EntityDetailPage(makeParams("fav-1"));
    render(ui);

    expect(
      screen.getByRole("heading", { name: "Arsenal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to teams/i }),
    ).toHaveAttribute("href", "/teams");
    expect(screen.getByTestId("entity-matches-client")).toHaveTextContent(
      "fav-1",
    );
    expect(listFavoritesMock).toHaveBeenCalledWith("u1");
  });

  it("renders the header for a valid player favorite", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([
      {
        id: "fav-2",
        type: "player",
        externalId: "abc123",
        displayName: "Jannik Sinner",
        sport: "Tennis",
      },
    ]);
    const ui = await EntityDetailPage(makeParams("fav-2"));
    render(ui);

    expect(
      screen.getByRole("heading", { name: "Jannik Sinner" }),
    ).toBeInTheDocument();
  });
});
