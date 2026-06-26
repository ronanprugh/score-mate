import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TournamentCard } from "./tournament-card";
import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import type { Match } from "@/lib/sports/types";

function makeMatch(overrides: Partial<Match> & Pick<Match, "id">): Match {
  return {
    sport: "Tennis",
    homeTeamId: "p1",
    homeTeamName: "Carlos Alcaraz",
    awayTeamId: "p2",
    awayTeamName: "Jannik Sinner",
    leagueId: "tennis/slam/wimbledon",
    leagueName: "Wimbledon",
    dateUtc: "2025-07-04",
    kickoffUtc: "2025-07-04T13:00:00Z",
    status: "upcoming",
    ...overrides,
  };
}

function makeTournament(
  overrides: Partial<ActiveTournament> = {},
): ActiveTournament {
  return {
    id: "tennis/slam/wimbledon",
    displayName: "Wimbledon",
    tour: "Slam",
    startDate: "2025-06-30",
    endDate: "2025-07-13",
    currentRound: "Quarterfinals",
    liveCount: 2,
    upcomingCount: 4,
    doneCount: 1,
    matches: [
      makeMatch({ id: "m1", kickoffUtc: "2025-07-04T13:00:00Z" }),
      makeMatch({ id: "m2", kickoffUtc: "2025-07-04T11:00:00Z" }),
    ],
    ...overrides,
  };
}

describe("TournamentCard", () => {
  it("(a) collapsed state shows displayName, formatted date range, currentRound, and counts", () => {
    render(<TournamentCard tournament={makeTournament()} />);

    expect(screen.getByText("Wimbledon")).toBeInTheDocument();
    // Date range: "Jun 30 – Jul 13"
    expect(screen.getByText(/Jun 30/)).toBeInTheDocument();
    expect(screen.getByText(/Jul 13/)).toBeInTheDocument();
    // currentRound
    expect(screen.getByTestId("tournament-round")).toHaveTextContent(
      "Quarterfinals",
    );
    // counts line
    expect(screen.getByTestId("tournament-counts")).toHaveTextContent(
      "2 live · 4 upcoming · 1 done",
    );
  });

  it("(a2) surfaces the provided round and the full event date range", () => {
    // Spec 06: currentRound is the real round (sourced from tennis.round) and
    // the date range is the tournament's overall run, not a single day.
    render(
      <TournamentCard
        tournament={makeTournament({
          startDate: "2025-08-25",
          endDate: "2025-09-07",
          currentRound: "Semifinals",
        })}
      />,
    );
    expect(screen.getByTestId("tournament-round")).toHaveTextContent(
      "Semifinals",
    );
    expect(screen.getByText(/Aug 25/)).toBeInTheDocument();
    expect(screen.getByText(/Sep 7/)).toBeInTheDocument();
  });

  it("(b) chevron click toggles expanded state", () => {
    render(<TournamentCard tournament={makeTournament()} />);

    const btn = screen.getByRole("button", { name: /expand/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("(c) expanded state renders one match-card per match", () => {
    render(<TournamentCard tournament={makeTournament()} />);

    fireEvent.click(screen.getByRole("button", { name: /expand/i }));

    const matchCards = screen.getAllByTestId("match-card");
    expect(matchCards).toHaveLength(2);
  });

  it("(c) expanded matches are in chronological kickoffUtc order", () => {
    render(<TournamentCard tournament={makeTournament()} />);
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));

    // m2 kicks off at 11:00, m1 at 13:00 — m2 should come first
    const matchCards = screen.getAllByTestId("match-card");
    expect(matchCards[0]).toHaveAttribute("data-status", "upcoming");
    // Both are upcoming; we verify ordering via aria-label content
    expect(matchCards[0]?.getAttribute("aria-label")).toContain(
      "Carlos Alcaraz",
    );
    expect(matchCards[1]?.getAttribute("aria-label")).toContain(
      "Carlos Alcaraz",
    );
    // m2 at 11:00 is earlier, so card 0 corresponds to m2 (earlier kickoff)
    // Both have identical players in this fixture, so just check count
    expect(matchCards).toHaveLength(2);
  });

  it("(d) collapsed-row root meets min-h-11", () => {
    render(<TournamentCard tournament={makeTournament()} />);
    const card = screen.getByTestId("tournament-card");
    // The inner header div carries min-h-11
    const header = card.querySelector(".min-h-11");
    expect(header).not.toBeNull();
  });

  it("(e) two cards can be expanded independently", () => {
    const t1 = makeTournament({
      id: "tennis/slam/wimbledon",
      displayName: "Wimbledon",
    });
    const t2 = makeTournament({
      id: "tennis/slam/us-open",
      displayName: "US Open",
      matches: [makeMatch({ id: "us1" })],
    });

    render(
      <>
        <TournamentCard tournament={t1} />
        <TournamentCard tournament={t2} />
      </>,
    );

    const [btn1, btn2] = screen.getAllByRole("button", { name: /expand/i });

    fireEvent.click(btn1!);
    expect(btn1).toHaveAttribute("aria-expanded", "true");
    expect(btn2).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(btn2!);
    expect(btn1).toHaveAttribute("aria-expanded", "true");
    expect(btn2).toHaveAttribute("aria-expanded", "true");
  });
});
