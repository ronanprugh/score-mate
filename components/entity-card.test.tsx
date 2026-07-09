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
  it("renders as a link to the entity's detail route with an accessible label", () => {
    render(<EntityCard entity={makeEntity({ favoriteId: "fav-42" })} />);
    const link = screen.getByRole("link", { name: "View Arsenal matches" });
    expect(link).toHaveAttribute("href", "/teams/fav-42");
  });

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

  it("shows a W/L result badge and the score on the last match", () => {
    render(
      <EntityCard
        entity={makeEntity({
          displayName: "Jannik Sinner",
          type: "player",
          lastMatch: {
            opponentName: "Jan-Lennard Struff",
            date: "2026-07-07",
            score: "7-5, 7-6, 6-3",
            result: "W",
            kickoffUtc: "2026-07-07T12:05:00Z",
            leagueName: "ATP",
          },
          nextMatch: {
            opponentName: "Novak Djokovic",
            date: "2026-07-10",
            kickoffUtc: "2026-07-10T04:00:00Z",
            leagueName: "ATP",
          },
        })}
      />,
    );

    expect(screen.getByLabelText("Win")).toHaveTextContent("W");
    expect(screen.getByText("7-5, 7-6, 6-3")).toBeInTheDocument();
    expect(screen.getByText(/Struff/)).toBeInTheDocument();
    expect(screen.getByText(/Djokovic/)).toBeInTheDocument();
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

  it("renders match rows for a player entity with last+next data", () => {
    render(
      <EntityCard
        entity={makeEntity({
          type: "player",
          displayName: "LeBron James",
          sport: "Basketball",
          lastMatch: {
            opponentName: "Houston Rockets",
            date: "2026-03-17",
            score: "120-110",
            kickoffUtc: "2026-03-17T01:30:00Z",
            leagueName: "NBA",
          },
          nextMatch: {
            opponentName: "Boston Celtics",
            date: "2026-03-20",
            kickoffUtc: "2026-03-20T00:00:00Z",
            leagueName: "NBA",
          },
        })}
      />,
    );

    expect(screen.getByText("LeBron James")).toBeInTheDocument();
    expect(screen.getByText(/Houston Rockets/)).toBeInTheDocument();
    expect(screen.getByText(/Boston Celtics/)).toBeInTheDocument();
    expect(
      screen.queryByText("Match data unavailable"),
    ).not.toBeInTheDocument();
  });

  it("shows 'Match data unavailable' for a player entity with no ESPN data", () => {
    render(
      <EntityCard
        entity={makeEntity({
          type: "player",
          displayName: "Obscure Athlete",
          sport: "Tennis",
          lastMatch: null,
          nextMatch: null,
        })}
      />,
    );

    expect(screen.getByText("Match data unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/No recent match/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No upcoming match/)).not.toBeInTheDocument();
  });
});
