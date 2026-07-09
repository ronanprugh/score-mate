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

/** A tournament with one singles match and one doubles match (both families). */
function bothFamiliesTournament(
  overrides: Partial<ActiveTournament> = {},
): ActiveTournament {
  return makeTournament({
    matches: [
      makeMatch({ id: "ms1", tennis: singles("Men's Singles") }),
      makeMatch({ id: "ms2", tennis: singles("Men's Singles") }),
      makeMatch({ id: "ws1", tennis: singles("Women's Singles") }),
      makeMatch({ id: "md1", tennis: singles("Men's Doubles") }),
    ],
    ...overrides,
  });
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

  it("(b) collapsed by default: renders zero discipline sections", () => {
    render(<TournamentCard tournament={bothFamiliesTournament()} />);
    expect(screen.queryAllByTestId("match-group")).toHaveLength(0);
    expect(screen.queryAllByTestId("match-card")).toHaveLength(0);
  });

  it("(b2) first activation reveals only the singles sections", () => {
    render(<TournamentCard tournament={bothFamiliesTournament()} />);
    const toggle = screen.getByRole("button", { name: /Wimbledon/ });
    fireEvent.click(toggle);

    const groups = screen.getAllByTestId("match-group");
    expect(groups).toHaveLength(2);
    expect(screen.getByText("Men's Singles")).toBeInTheDocument();
    expect(screen.getByText("Women's Singles")).toBeInTheDocument();
    expect(screen.queryByText("Men's Doubles")).toBeNull();
  });

  it("(b3) second activation additionally reveals doubles sections", () => {
    render(<TournamentCard tournament={bothFamiliesTournament()} />);
    const toggle = screen.getByRole("button", { name: /Wimbledon/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    const groups = screen.getAllByTestId("match-group");
    expect(groups).toHaveLength(3);
    expect(screen.getByText("Men's Singles")).toBeInTheDocument();
    expect(screen.getByText("Women's Singles")).toBeInTheDocument();
    expect(screen.getByText("Men's Doubles")).toBeInTheDocument();
  });

  it("(b4) a third activation wraps back to collapsed", () => {
    render(<TournamentCard tournament={bothFamiliesTournament()} />);
    const toggle = screen.getByRole("button", { name: /Wimbledon/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryAllByTestId("match-group")).toHaveLength(0);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("(b5) aria-expanded and stage hint update across the click cycle", () => {
    render(<TournamentCard tournament={bothFamiliesTournament()} />);
    const toggle = screen.getByRole("button", { name: /Wimbledon/ });

    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("tournament-stage-hint")).toHaveTextContent(
      "Singles",
    );

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("tournament-stage-hint")).toHaveTextContent(
      "Singles + Doubles",
    );
  });

  it("(c) a revealed section still expands independently to show its match cards", () => {
    render(<TournamentCard tournament={makeTournament()} />);
    fireEvent.click(screen.getByRole("button", { name: /Wimbledon/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Men's Singles/ }));
    expect(screen.getAllByTestId("match-card")).toHaveLength(2);
  });

  it("(c3) singles-only tournament has a single expanded stage with only singles", () => {
    const tournament = makeTournament({
      matches: [makeMatch({ id: "ms1", tennis: singles("Men's Singles") })],
    });
    render(<TournamentCard tournament={tournament} />);
    const toggle = screen.getByRole("button", { name: /Wimbledon/ });

    fireEvent.click(toggle);
    expect(screen.getAllByTestId("match-group")).toHaveLength(1);
    expect(screen.queryByText("Women's Singles")).toBeNull();

    // Wraps directly back to collapsed (no doubles stage).
    fireEvent.click(toggle);
    expect(screen.queryAllByTestId("match-group")).toHaveLength(0);
  });

  it("(c4) doubles-only tournament reveals its doubles sections on first activation", () => {
    const tournament = makeTournament({
      matches: [
        makeMatch({ id: "md1", tennis: singles("Men's Doubles") }),
        makeMatch({ id: "xd1", tennis: singles("Mixed Doubles") }),
      ],
    });
    render(<TournamentCard tournament={tournament} />);
    const toggle = screen.getByRole("button", { name: /Wimbledon/ });

    fireEvent.click(toggle);
    expect(screen.getAllByTestId("match-group")).toHaveLength(2);
    expect(screen.getByText("Men's Doubles")).toBeInTheDocument();
    expect(screen.getByText("Mixed Doubles")).toBeInTheDocument();
  });

  it("(c5) renders no toggle and no section body when no match is classifiable", () => {
    const tournament = makeTournament({
      matches: [
        makeMatch({ id: "j1", tennis: singles("Boys' Singles") }),
        makeMatch({ id: "j2", tennis: singles("Wheelchair Men's Singles") }),
      ],
    });
    render(<TournamentCard tournament={tournament} />);
    expect(screen.queryByRole("button", { name: /Wimbledon/ })).toBeNull();
    expect(screen.queryAllByTestId("match-group")).toHaveLength(0);
    expect(screen.queryAllByTestId("match-card")).toHaveLength(0);
  });

  it("(d) header row meets min-h-11", () => {
    render(<TournamentCard tournament={makeTournament()} />);
    const card = screen.getByTestId("tournament-card");
    const header = card.querySelector(".min-h-11");
    expect(header).not.toBeNull();
  });

  it("(e) sections in two cards expand independently", () => {
    const t1 = makeTournament({ id: "tennis/slam/wimbledon" });
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

    const [toggle1, toggle2] = screen.getAllByRole("button", {
      name: /Wimbledon|US Open/,
    });
    fireEvent.click(toggle1!);
    expect(toggle1).toHaveAttribute("aria-expanded", "true");
    expect(toggle2).toHaveAttribute("aria-expanded", "false");
  });

  it("(f) stage resets to collapsed on remount (ephemeral, non-persisted state)", () => {
    const { unmount } = render(
      <TournamentCard tournament={bothFamiliesTournament()} />,
    );
    const toggle = screen.getByRole("button", { name: /Wimbledon/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getAllByTestId("match-group")).toHaveLength(3);
    unmount();

    render(<TournamentCard tournament={bothFamiliesTournament()} />);
    expect(screen.queryAllByTestId("match-group")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Wimbledon/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
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
