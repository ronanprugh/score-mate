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

vi.mock("@/components/home-client", () => ({
  HomeClient: ({ hasFavorites }: { hasFavorites: boolean }) => (
    <div data-testid="home-client" data-has-favorites={String(hasFavorites)}>
      HomeClient
    </div>
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

import HomePage from "./page";

describe("Home page (server shell)", () => {
  beforeEach(() => {
    authMock.mockReset();
    listFavoritesMock.mockReset();
  });

  it("redirects to /signin when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(HomePage()).rejects.toThrow(/__REDIRECT__:\/signin/);
  });

  it("redirects to /signin when the session user has no id", async () => {
    authMock.mockResolvedValue({ user: { email: "x@y" } });
    await expect(HomePage()).rejects.toThrow(/__REDIRECT__:\/signin/);
  });

  it("renders the header and embeds HomeClient when signed in", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([]);
    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /your matches/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("home-client")).toHaveAttribute(
      "data-has-favorites",
      "false",
    );
  });

  it("passes hasFavorites=true when the user has favorites", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b" } });
    listFavoritesMock.mockResolvedValue([{ id: "f1" }]);
    const ui = await HomePage();
    render(ui);
    expect(screen.getByTestId("home-client")).toHaveAttribute(
      "data-has-favorites",
      "true",
    );
    expect(listFavoritesMock).toHaveBeenCalledWith("u1");
  });
});
