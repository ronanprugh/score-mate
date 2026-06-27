import { describe, expect, it, vi, beforeEach } from "vitest";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

import MyFavoritesPage from "./page";

describe("MyFavoritesPage", () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it("redirects to the unified /favorites page", () => {
    MyFavoritesPage();
    expect(redirectMock).toHaveBeenCalledWith("/favorites");
  });
});
