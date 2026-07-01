import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MatchGroupSection } from "./match-group-section";
import type { Match } from "@/lib/sports/types";

function makeMatch(id: string, overrides: Partial<Match> = {}): Match {
  return {
    id,
    sport: "Tennis",
    homeTeamId: `${id}-h`,
    homeTeamName: `${id} Home`,
    awayTeamId: `${id}-a`,
    awayTeamName: `${id} Away`,
    leagueId: "tennis/slam/wimbledon",
    leagueName: "Wimbledon",
    dateUtc: "2026-07-01",
    kickoffUtc: "2026-07-01T13:00:00Z",
    status: "upcoming",
    tennis: {
      draw: "Men's Singles",
      home: { sets: [], won: false },
      away: { sets: [], won: false },
    },
    ...overrides,
  };
}

/** N upcoming matches m0..m(n-1). */
function makeMatches(n: number): Match[] {
  return Array.from({ length: n }, (_, i) => makeMatch(`m${i}`));
}

describe("MatchGroupSection", () => {
  it("renders collapsed by default: label + count shown, no match cards", () => {
    render(
      <MatchGroupSection label="Men's Singles" matches={makeMatches(8)} />,
    );
    expect(screen.getByText("Men's Singles")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Men's Singles/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByTestId("match-card")).toHaveLength(0);
  });

  it("expands to at most 5 matches with a Show more control", () => {
    render(
      <MatchGroupSection label="Men's Singles" matches={makeMatches(8)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Men's Singles/i }));
    expect(screen.getAllByTestId("match-card")).toHaveLength(5);
    expect(
      screen.getByRole("button", { name: /Show more \(3\)/ }),
    ).toBeInTheDocument();
  });

  it("Show more reveals 5 more and disappears when exhausted", () => {
    render(
      <MatchGroupSection label="Men's Singles" matches={makeMatches(8)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Men's Singles/i }));
    fireEvent.click(screen.getByRole("button", { name: /Show more \(3\)/ }));
    expect(screen.getAllByTestId("match-card")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("no Show more control when 5 or fewer matches", () => {
    render(
      <MatchGroupSection label="Women's Doubles" matches={makeMatches(4)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Women's Doubles/i }));
    expect(screen.getAllByTestId("match-card")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("collapsing resets the visible count back to 5", () => {
    render(
      <MatchGroupSection label="Men's Singles" matches={makeMatches(8)} />,
    );
    const toggle = screen.getByRole("button", { name: /Men's Singles/i });
    fireEvent.click(toggle); // open
    fireEvent.click(screen.getByRole("button", { name: /Show more \(3\)/ })); // show all 8
    expect(screen.getAllByTestId("match-card")).toHaveLength(8);
    fireEvent.click(toggle); // collapse
    fireEvent.click(toggle); // re-open
    expect(screen.getAllByTestId("match-card")).toHaveLength(5);
    expect(
      screen.getByRole("button", { name: /Show more \(3\)/ }),
    ).toBeInTheDocument();
  });

  it("pins a live match first even when its priority is low", () => {
    // A low-seed live match placed last in priority order must still render first.
    const matches: Match[] = [
      makeMatch("top", {
        homeTeamName: "Top Seed",
        tennis: {
          draw: "Men's Singles",
          home: { sets: [], won: false, seed: 1 },
          away: { sets: [], won: false, seed: 2 },
        },
      }),
      makeMatch("live", {
        homeTeamName: "Live Underdog",
        status: "live",
        tennis: {
          draw: "Men's Singles",
          home: { sets: [], won: false },
          away: { sets: [], won: false },
        },
      }),
    ];
    render(<MatchGroupSection label="Men's Singles" matches={matches} />);
    fireEvent.click(screen.getByRole("button", { name: /Men's Singles/i }));
    const cards = screen.getAllByTestId("match-card");
    expect(within(cards[0]!).getByText(/Live Underdog/)).toBeInTheDocument();
  });

  it("toggles open under StrictMode", () => {
    // Next dev renders under StrictMode (double-invoked updaters); keep the
    // toggle behaving there too, and keep state updaters pure.
    render(
      <StrictMode>
        <MatchGroupSection label="Men's Singles" matches={makeMatches(8)} />
      </StrictMode>,
    );
    const toggle = screen.getByRole("button", { name: /Men's Singles/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("match-card")).toHaveLength(5);
  });

  it("toggle and Show more controls meet the 44px touch target (min-h-11)", () => {
    render(
      <MatchGroupSection label="Men's Singles" matches={makeMatches(8)} />,
    );
    const toggle = screen.getByRole("button", { name: /Men's Singles/i });
    expect(toggle.className).toContain("min-h-11");
    fireEvent.click(toggle);
    const showMore = screen.getByRole("button", { name: /Show more/ });
    expect(showMore.className).toContain("min-h-11");
  });
});
