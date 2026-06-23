import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

import { FavoritesSearch } from "./favorites-search";

const TYPE_RESULTS = {
  results: [
    {
      type: "team",
      externalId: "133604",
      displayName: "Arsenal",
      sport: "Soccer",
    },
    {
      type: "league",
      externalId: "4328",
      displayName: "English Premier League",
      sport: "Soccer",
    },
    {
      type: "sport",
      externalId: "Soccer",
      displayName: "Soccer (top matches)",
      sport: "Soccer",
    },
    {
      type: "event",
      externalId: "fifa-world-cup-2026",
      displayName: "FIFA World Cup 2026",
      sport: "Soccer",
      metadata: { startDate: "2026-06-11", endDate: "2026-07-19" },
    },
  ],
};

// Use real timers throughout. The 300ms debounce is short enough that
// waitFor's default 1s timeout absorbs it without flake.

describe("FavoritesSearch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("does not search until at least 2 characters are entered", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    } as Response);

    render(<FavoritesSearch initialFavorites={[]} />);
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "a" },
    });
    // Wait past the debounce window; even after that, no fetch should fire.
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders one type-labeled row per result with an Add CTA", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => TYPE_RESULTS,
    } as Response);

    render(<FavoritesSearch initialFavorites={[]} />);
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "soc" },
    });

    await waitFor(() =>
      expect(screen.getByText("Arsenal")).toBeInTheDocument(),
    );

    expect(screen.getByText(/Team · Soccer/)).toBeInTheDocument();
    expect(screen.getByText(/League · Soccer/)).toBeInTheDocument();
    expect(screen.getByText(/Sport · Soccer/)).toBeInTheDocument();
    expect(screen.getByText(/Event · Soccer/)).toBeInTheDocument();

    const addButtons = screen.getAllByRole("button", {
      name: /add .* to favorites/i,
    });
    expect(addButtons).toHaveLength(4);
    for (const btn of addButtons) {
      expect(btn.className).toMatch(/\bmin-h-11\b/);
      expect(btn.className).toMatch(/\bmin-w-11\b/);
    }
  });

  it("renders a row that's already in initialFavorites as 'Added' (disabled)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => TYPE_RESULTS,
    } as Response);

    render(
      <FavoritesSearch
        initialFavorites={[{ type: "team", externalId: "133604" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "soc" },
    });

    await waitFor(() =>
      expect(screen.getByText("Arsenal")).toBeInTheDocument(),
    );

    const arsenalBtn = screen.getByRole("button", {
      name: /remove Arsenal from favorites — use the My Favorites screen/i,
    });
    expect(arsenalBtn).toHaveTextContent(/added/i);
    expect(arsenalBtn).toBeDisabled();
  });
});
