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

vi.mock("@/components/teams-client", () => ({
  TeamsClient: () => <div data-testid="teams-client">TeamsClient</div>,
}));

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const listFavoritesMock = vi.fn();
vi.mock("@/lib/favorites/queries", () => ({
  listFavoritesForUser: (userId: string) => listFavoritesMock(userId),
}));

import TeamsPage from "./page";

describe("Teams page (server shell)", () => {
  beforeEach(() => {
    authMock.mockReset();
    listFavoritesMock.mockReset();
  });

  it("redirects to /signin when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(TeamsPage()).rejects.toThrow(/__REDIRECT__:\/signin/);
  });

  it("renders the empty state with a link to /favorites when there are no team/player favorites", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([]);
    const ui = await TeamsPage();
    render(ui);

    expect(screen.getByTestId("teams-empty-prompt")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /add a team or player/i });
    expect(link).toHaveAttribute("href", "/favorites");
    expect(screen.queryByTestId("teams-client")).not.toBeInTheDocument();
    expect(listFavoritesMock).toHaveBeenCalledWith("u1");
  });

  it("renders the TeamsClient when the user has a team favorite", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([
      { id: "f1", type: "team", externalId: "133602", displayName: "Arsenal" },
    ]);
    const ui = await TeamsPage();
    render(ui);

    expect(screen.getByTestId("teams-client")).toBeInTheDocument();
    expect(screen.queryByTestId("teams-empty-prompt")).not.toBeInTheDocument();
  });
});
