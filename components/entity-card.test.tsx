import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TeamEntity } from "@/lib/teams/types";
import { EntityCard } from "./entity-card";

function makeEntity(over: Partial<TeamEntity> = {}): TeamEntity {
  return {
    favoriteId: "fav-1",
    displayName: "Arsenal",
    type: "team",
    sport: "Soccer",
    lastMatch: null,
    nextMatch: null,
    ...over,
  };
}

describe("EntityCard", () => {
  it("renders both last and next match rows when populated", () => {
    render(
      <EntityCard
        entity={makeEntity({
          lastMatch: {
            opponentName: "Chelsea",
            date: "2026-06-20",
            score: "2-1",
            kickoffUtc: "2026-06-20T15:00:00Z",
            leagueName: "English Premier League",
          },
          nextMatch: {
            opponentName: "Spurs",
            date: "2026-06-28",
            kickoffUtc: "2026-06-28T14:00:00Z",
            leagueName: "English Premier League",
          },
        })}
      />,
    );

    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(screen.getByText("2-1")).toBeInTheDocument();
    expect(screen.getByText(/Chelsea/)).toBeInTheDocument();
    expect(screen.getByText(/Spurs/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Match data unavailable/),
    ).not.toBeInTheDocument();
  });

  it("shows 'Match data unavailable' when both matches are null", () => {
    render(<EntityCard entity={makeEntity()} />);
    expect(screen.getByText("Match data unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/No recent match/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No upcoming match/)).not.toBeInTheDocument();
  });

  it("shows 'No recent match' for last and the opponent for next when only nextMatch is present", () => {
    render(
      <EntityCard
        entity={makeEntity({
          lastMatch: null,
          nextMatch: {
            opponentName: "Spurs",
            date: "2026-06-28",
            kickoffUtc: "2026-06-28T14:00:00Z",
            leagueName: "English Premier League",
          },
        })}
      />,
    );

    expect(screen.getByText("No recent match")).toBeInTheDocument();
    expect(screen.getByText(/Spurs/)).toBeInTheDocument();
    expect(
      screen.queryByText("Match data unavailable"),
    ).not.toBeInTheDocument();
  });
});
