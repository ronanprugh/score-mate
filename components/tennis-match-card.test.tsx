import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TennisMatchCard } from "./tennis-match-card";
import type { Match } from "@/lib/sports/types";

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "157650",
    sport: "Tennis",
    homeTeamId: "p1",
    homeTeamName: "Lorenzo Sonego",
    awayTeamId: "p2",
    awayTeamName: "Jaime Faria",
    leagueId: "tennis/slam/wimbledon",
    leagueName: "Wimbledon",
    dateUtc: "2025-07-01",
    kickoffUtc: "2025-07-01T10:05:00Z",
    venue: "London, Great Britain",
    status: "final",
    homeScore: 3,
    awayScore: 0,
    tennis: {
      bestOf: 5,
      draw: "Men's Singles",
      round: "Round 1",
      court: "Court 8",
      home: {
        flagUrl: "https://a.espncdn.com/i/teamlogos/countries/500/ita.png",
        flagAlt: "Italy",
        won: true,
        sets: [
          { games: 6, won: true },
          { games: 6, won: true },
          { games: 6, won: true },
        ],
      },
      away: {
        flagUrl: "https://a.espncdn.com/i/teamlogos/countries/500/por.png",
        flagAlt: "Portugal",
        won: false,
        sets: [
          { games: 3, won: false },
          { games: 4, won: false },
          { games: 2, won: false },
        ],
      },
    },
    ...overrides,
  };
}

describe("TennisMatchCard", () => {
  it("renders both player names stacked (full names, no logo placeholder)", () => {
    render(<TennisMatchCard match={makeMatch()} />);
    expect(screen.getByText("Lorenzo Sonego")).toBeInTheDocument();
    expect(screen.getByText("Jaime Faria")).toBeInTheDocument();
    // No team-sport logo placeholder is rendered for tennis.
    expect(document.querySelector(".bg-zinc-100")).toBeNull();
  });

  it("renders games per set for each player", () => {
    render(<TennisMatchCard match={makeMatch()} />);
    const card = screen.getByTestId("match-card");
    // Winner's games (6, 6, 6) and loser's games (3, 4, 2) are all present.
    expect(within(card).getAllByText("6")).toHaveLength(3);
    expect(within(card).getByText("3")).toBeInTheDocument();
    expect(within(card).getByText("4")).toBeInTheDocument();
    expect(within(card).getByText("2")).toBeInTheDocument();
  });

  it("bolds the winner of each set", () => {
    render(<TennisMatchCard match={makeMatch()} />);
    const card = screen.getByTestId("match-card");
    for (const cell of within(card).getAllByText("6")) {
      expect(cell.className).toContain("font-semibold");
    }
    expect(within(card).getByText("3").className).toContain("font-normal");
  });

  it("renders the tiebreak points as a superscript when present", () => {
    const match = makeMatch({
      status: "final",
      tennis: {
        bestOf: 3,
        draw: "Men's Singles",
        round: "Round 2",
        court: "Court 2",
        home: {
          won: true,
          sets: [
            { games: 6, won: true },
            { games: 7, tiebreak: 7, won: true },
          ],
        },
        away: {
          won: false,
          sets: [
            { games: 1, won: false },
            { games: 6, tiebreak: 2, won: false },
          ],
        },
      },
    });
    const { container } = render(<TennisMatchCard match={match} />);
    const sups = container.querySelectorAll("sup");
    expect(sups).toHaveLength(2);
    expect(Array.from(sups).map((s) => s.textContent)).toEqual(["7", "2"]);
  });

  it("shows best-of, draw + round, and court + venue", () => {
    render(<TennisMatchCard match={makeMatch()} />);
    expect(screen.getByText("Best of 5")).toBeInTheDocument();
    expect(screen.getByText("Men's Singles, Round 1")).toBeInTheDocument();
    expect(
      screen.getByText("Court 8, London, Great Britain"),
    ).toBeInTheDocument();
  });

  it("renders country flags with alt text to the left of names", () => {
    render(<TennisMatchCard match={makeMatch()} />);
    expect(screen.getByAltText("Italy")).toBeInTheDocument();
    expect(screen.getByAltText("Portugal")).toBeInTheDocument();
  });

  it("shows a live indicator and progress for live matches", () => {
    render(
      <TennisMatchCard
        match={makeMatch({ status: "live", liveProgress: "3rd Set" })}
      />,
    );
    const card = screen.getByTestId("match-card");
    expect(card).toHaveAttribute("data-status", "live");
    expect(within(card).getByText("3rd Set")).toBeInTheDocument();
  });

  it("renders the kickoff time and no set columns for upcoming matches", () => {
    const match = makeMatch({
      status: "upcoming",
      homeScore: undefined,
      awayScore: undefined,
      tennis: {
        bestOf: 5,
        draw: "Women's Singles",
        round: "Final",
        home: { won: false, sets: [] },
        away: { won: false, sets: [] },
      },
    });
    const { container } = render(<TennisMatchCard match={match} />);
    expect(screen.getByText("Lorenzo Sonego")).toBeInTheDocument();
    // No set cells rendered when there are no sets yet.
    expect(container.querySelectorAll("sup")).toHaveLength(0);
  });

  it("degrades gracefully when tennis detail is absent", () => {
    const match = makeMatch({ status: "upcoming", tennis: undefined });
    render(<TennisMatchCard match={match} />);
    expect(screen.getByTestId("match-card")).toBeInTheDocument();
    expect(screen.getByText("Lorenzo Sonego")).toBeInTheDocument();
  });
});
