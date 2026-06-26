import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCard } from "./match-card";
import type { Match } from "@/lib/sports/types";

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
    // The team block wraps an optional prefix line + the main name line;
    // both inner spans carry `truncate`, and the wrapper carries the
    // full name in its `title` attribute for hover discoverability.
    const wrapper = screen.getByTitle(longName);
    const truncatedSpans = wrapper.querySelectorAll(".truncate");
    expect(truncatedSpans.length).toBeGreaterThan(0);
  });

  it("uses a uniform min-h on the card for consistent height across states", () => {
    render(<MatchCard match={{ ...base, status: "upcoming" }} />);
    const card = screen.getByTestId("match-card");
    expect(card.className).toMatch(/\bmin-h-\d+\b/);
  });

  describe("player-vs-player (tennis)", () => {
    const tennisMatch = {
      ...base,
      sport: "Tennis" as const,
      homeTeamName: "Carlos Alcaraz",
      homeTeamShortName: undefined,
      homeTeamLogo: undefined,
      awayTeamName: "Jannik Sinner",
      awayTeamShortName: undefined,
      awayTeamLogo: undefined,
      status: "live" as const,
      homeScore: 2,
      awayScore: 1,
    };

    it("renders both full player names verbatim in the DOM", () => {
      render(<MatchCard match={tennisMatch} />);
      expect(screen.getByText("Carlos Alcaraz")).toBeInTheDocument();
      expect(screen.getByText("Jannik Sinner")).toBeInTheDocument();
    });

    it("renders no logo placeholder (bg-zinc-100) when both logos are absent", () => {
      const { container } = render(<MatchCard match={tennisMatch} />);
      const placeholders = container.querySelectorAll(".bg-zinc-100");
      expect(placeholders).toHaveLength(0);
    });

    it("renders no prefix span (text-xs city/org prefix) for player names", () => {
      const { container } = render(<MatchCard match={tennisMatch} />);
      // prefix spans carry `text-xs`; with player-vs-player there should be none
      // inside the team-side name block (the only text-xs elements are in the footer)
      const nameBlocks = container.querySelectorAll("[title]");
      for (const block of nameBlocks) {
        const prefixSpans = block.querySelectorAll(".text-xs");
        expect(prefixSpans).toHaveLength(0);
      }
    });

    it("score column works the same as team sports", () => {
      render(<MatchCard match={tennisMatch} />);
      expect(screen.getByTestId("home-score")).toHaveTextContent("2");
      expect(screen.getByTestId("away-score")).toHaveTextContent("1");
    });
  });
});
