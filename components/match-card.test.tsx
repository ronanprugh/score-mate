import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCard } from "./match-card";
import type { Match } from "@/lib/sportsdb/types";

const base: Match = {
  id: "evt1",
  sport: "Soccer",
  homeTeamId: "t1",
  homeTeamName: "Arsenal",
  awayTeamId: "t2",
  awayTeamName: "Chelsea",
  leagueId: "4328",
  leagueName: "English Premier League",
  dateUtc: "2026-06-24",
  kickoffUtc: "2026-06-24T19:30:00Z",
  status: "upcoming",
};

describe("MatchCard", () => {
  it("renders the Final branch with both scores", () => {
    render(
      <MatchCard
        match={{ ...base, status: "final", homeScore: 2, awayScore: 1 }}
      />,
    );
    expect(screen.getByTestId("final-label")).toHaveTextContent(/final/i);
    expect(screen.getByTestId("home-score")).toHaveTextContent("2");
    expect(screen.getByTestId("away-score")).toHaveTextContent("1");
    expect(screen.queryByTestId("live-pill")).not.toBeInTheDocument();
  });

  it("renders the Live branch with score + progress", () => {
    render(
      <MatchCard
        match={{
          ...base,
          status: "live",
          homeScore: 1,
          awayScore: 1,
          liveProgress: "73'",
        }}
      />,
    );
    expect(screen.getByTestId("live-pill")).toHaveTextContent(/live/i);
    expect(screen.getByTestId("live-progress")).toHaveTextContent("73'");
    expect(screen.getByTestId("home-score")).toHaveTextContent("1");
  });

  it("renders the Upcoming branch with kickoff time and broadcast", () => {
    render(
      <MatchCard
        match={{
          ...base,
          status: "upcoming",
          broadcast: "Peacock",
        }}
      />,
    );
    expect(screen.getByTestId("upcoming-time")).toBeInTheDocument();
    expect(screen.getByTestId("broadcast")).toHaveTextContent("Peacock");
    expect(screen.queryByTestId("home-score")).not.toBeInTheDocument();
  });

  it("truncates long team names with a title attribute", () => {
    const longName =
      "Borussia Mönchengladbach Reserves and Academy Selection XI";
    render(<MatchCard match={{ ...base, homeTeamName: longName }} />);
    const homeNode = screen.getByTitle(longName);
    expect(homeNode.className).toMatch(/truncate/);
  });

  it("uses a uniform min-h on the card for consistent height across states", () => {
    render(<MatchCard match={{ ...base, status: "upcoming" }} />);
    const card = screen.getByTestId("match-card");
    expect(card.className).toMatch(/\bmin-h-\d+\b/);
  });
});
