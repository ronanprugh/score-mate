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
    tennis: {
      draw: "Men's Singles",
      home: { sets: [], won: false },
      away: { sets: [], won: false },
    },
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
    expect(screen.getByText(/Jun 30/)).toBeInTheDocument();
    expect(screen.getByText(/Jul 13/)).toBeInTheDocument();
    expect(screen.getByTestId("tournament-round")).toHaveTextContent(
      "Quarterfinals",
    );
    expect(screen.getByTestId("tournament-counts")).toHaveTextContent(
      "2 live · 4 upcoming · 1 done",
    );
  });

  it("(a2) surfaces the provided round and the full event date range", () => {
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

  it("(b) chevron click toggles the card's expanded state", () => {
    render(<TournamentCard tournament={makeTournament()} />);

    const btn = screen.getByRole("button", { name: /expand/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("(c) expanded card renders discipline sections (collapsed) with label + count, not a flat match list", () => {
    const tournament = makeTournament({
      matches: [
        makeMatch({ id: "ms1", tennis: singles("Men's Singles") }),
        makeMatch({ id: "ms2", tennis: singles("Men's Singles") }),
        makeMatch({ id: "ws1", tennis: singles("Women's Singles") }),
      ],
    });
    render(<TournamentCard tournament={tournament} />);
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));

    // Two sections; sections start collapsed so no match-cards are visible yet.
    const sections = screen.getAllByTestId("match-group");
    expect(sections).toHaveLength(2);
    expect(screen.getByText("Men's Singles")).toBeInTheDocument();
    expect(screen.getByText("Women's Singles")).toBeInTheDocument();
    expect(screen.queryAllByTestId("match-card")).toHaveLength(0);

    // Men's Singles count is 2.
    const mens = screen.getByRole("button", { name: /^Men's Singles/ });
    expect(mens).toHaveTextContent("2");
  });

  it("(c2) a section expands to reveal its match cards", () => {
    render(<TournamentCard tournament={makeTournament()} />);
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Men's Singles/ }));
    expect(screen.getAllByTestId("match-card")).toHaveLength(2);
  });

  it("(c3) omits disciplines with zero matches", () => {
    const tournament = makeTournament({
      matches: [makeMatch({ id: "ms1", tennis: singles("Men's Singles") })],
    });
    render(<TournamentCard tournament={tournament} />);
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(screen.getAllByTestId("match-group")).toHaveLength(1);
    expect(screen.queryByText("Women's Singles")).toBeNull();
  });

  it("(c4) renders no section body when no match is classifiable", () => {
    const tournament = makeTournament({
      matches: [
        makeMatch({ id: "j1", tennis: singles("Boys' Singles") }),
        makeMatch({ id: "j2", tennis: singles("Wheelchair Men's Singles") }),
      ],
    });
    render(<TournamentCard tournament={tournament} />);
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(screen.queryAllByTestId("match-group")).toHaveLength(0);
    expect(screen.queryAllByTestId("match-card")).toHaveLength(0);
  });

  it("(d) collapsed-row root meets min-h-11", () => {
    render(<TournamentCard tournament={makeTournament()} />);
    const card = screen.getByTestId("tournament-card");
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

/** Builds a tennis detail block for the given draw. */
function singles(draw: string): Match["tennis"] {
  return {
    draw,
    home: { sets: [], won: false },
    away: { sets: [], won: false },
  };
}
