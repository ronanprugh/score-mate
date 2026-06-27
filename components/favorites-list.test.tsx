import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FavoritesList } from "./favorites-list";
import type { FavoriteRow } from "@/db/schema/favorites";
import type { FavoriteType, Sport } from "@/lib/sports/types";

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

const ROW = (
  id: string,
  type: FavoriteType,
  name: string,
  sport: Sport = "Soccer",
): FavoriteRow => ({
  id,
  userId: "user-a",
  type,
  externalId: `ext-${id}`,
  displayName: name,
  sport,
  metadata: null,
  createdAt: new Date("2026-06-22T12:00:00Z"),
});

describe("FavoritesList", () => {
  it("renders the empty state when there are no favorites", () => {
    render(<FavoritesList favorites={[]} />);
    expect(screen.getByTestId("favorites-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/haven't favorited anything yet/i),
    ).toBeInTheDocument();
  });

  it("renders one section per present favorite type with rows + remove buttons", () => {
    render(
      <FavoritesList
        favorites={[
          ROW("1", "team", "Arsenal"),
          ROW("2", "league", "Premier League"),
          ROW("3", "sport", "Soccer (top matches)"),
          ROW("4", "event", "FIFA World Cup 2026"),
        ]}
      />,
    );

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
    expect(screen.getByText("FIFA World Cup 2026")).toBeInTheDocument();

    // A remove button is rendered for every row.
    expect(screen.getByTestId("remove-1")).toBeInTheDocument();
    expect(screen.getByTestId("remove-2")).toBeInTheDocument();
    expect(screen.getByTestId("remove-3")).toBeInTheDocument();
    expect(screen.getByTestId("remove-4")).toBeInTheDocument();
  });

  it("hides sections for favorite types the user has none of", () => {
    render(<FavoritesList favorites={[ROW("1", "team", "Arsenal")]} />);
    expect(
      screen.getByRole("heading", { name: /^Teams$/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^Leagues$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^Sports$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^Tournaments$/ }),
    ).not.toBeInTheDocument();
  });
});
