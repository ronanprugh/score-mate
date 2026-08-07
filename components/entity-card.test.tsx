import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Match } from "@/lib/sports/types";
import type { TeamEntity } from "@/lib/teams/types";
import { EntityCard } from "./entity-card";

function makeMatch(over: Partial<Match> & Pick<Match, "id">): Match {
  return {
    sport: "Soccer",
    homeTeamId: "364",
    homeTeamName: "Liverpool",
    homeTeamShortName: "Liverpool",
    homeTeamLogo: "https://example.test/liverpool.png",
    awayTeamId: "357",
    awayTeamName: "Leeds United",
    awayTeamShortName: "Leeds",
    awayTeamLogo: "https://example.test/leeds.png",
    leagueId: "soccer/eng.1",
    leagueName: "Premier League",
    dateUtc: "2026-05-24",
    kickoffUtc: "2026-05-24T15:00:00Z",
    status: "final",
    ...over,
  } as Match;
}

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

  it("keeps the header tap target at the 44px minimum", () => {
    // AGENTS.md: primary interactive elements meet >=44x44px (min-h-11).
    render(<EntityCard entity={makeEntity()} />);
    const link = screen.getByRole("link", { name: "View Arsenal matches" });
    expect(link.className).toContain("min-h-11");
  });

  it("renders a Home-style match card for each populated side", () => {
    render(
      <EntityCard
        entity={makeEntity({
          lastMatch: makeMatch({ id: "m1", homeScore: 2, awayScore: 4 }),
          nextMatch: makeMatch({
            id: "m2",
            status: "upcoming",
            dateUtc: "2026-08-15",
            kickoffUtc: "2026-08-15T19:00:00Z",
          }),
        })}
      />,
    );

    const cards = screen.getAllByTestId("match-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("data-status", "final");
    expect(cards[1]).toHaveAttribute("data-status", "upcoming");
  });

  it("shows both sides' names and the score, not a one-sided summary", () => {
    // The point of the redesign: the old row showed "vs Leeds  2-4" from the
    // followed team's perspective. The card shows the fixture as it happened.
    render(
      <EntityCard
        entity={makeEntity({
          lastMatch: makeMatch({ id: "m1", homeScore: 2, awayScore: 4 }),
        })}
      />,
    );

    const card = screen.getByTestId("match-card");
    expect(within(card).getByText("Liverpool")).toBeInTheDocument();
    // "Leeds United" does not end with its short name "Leeds", so MatchCard
    // renders the full name unsplit — see splitTeamName.
    expect(within(card).getByText("Leeds United")).toBeInTheDocument();
    expect(within(card).getByTestId("home-score")).toHaveTextContent("2");
    expect(within(card).getByTestId("away-score")).toHaveTextContent("4");
  });

  it("labels the slots so a lone card is unambiguous", () => {
    render(
      <EntityCard
        entity={makeEntity({ lastMatch: makeMatch({ id: "m1" }) })}
      />,
    );
    expect(screen.getByText("Last")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("renders the tennis card for a tennis entity", () => {
    render(
      <EntityCard
        entity={makeEntity({
          displayName: "Jannik Sinner",
          type: "player",
          sport: "Tennis",
          lastMatch: makeMatch({
            id: "t1",
            sport: "Tennis",
            homeTeamName: "Jannik Sinner",
            awayTeamName: "Carlos Alcaraz",
            homeTeamLogo: undefined,
            awayTeamLogo: undefined,
            leagueId: "tennis/atp",
            leagueName: "ATP",
          }),
        })}
      />,
    );

    // Both cards share the "match-card" testid, so discriminate on
    // "match-center" — the fixed-width score/kickoff column that only the
    // team-sport MatchCard renders.
    expect(screen.getByTestId("match-card")).toBeInTheDocument();
    expect(screen.queryByTestId("match-center")).not.toBeInTheDocument();
  });

  it("renders the team-sport card (not the tennis card) for a soccer entity", () => {
    render(
      <EntityCard
        entity={makeEntity({ lastMatch: makeMatch({ id: "m1" }) })}
      />,
    );
    expect(screen.getByTestId("match-center")).toBeInTheDocument();
  });

  it("shows 'Match data unavailable' when both matches are null", () => {
    render(<EntityCard entity={makeEntity()} />);
    expect(screen.getByText("Match data unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("match-card")).not.toBeInTheDocument();
  });

  it("shows per-side empty copy when only one side is missing", () => {
    render(
      <EntityCard
        entity={makeEntity({
          nextMatch: makeMatch({ id: "m2", status: "upcoming" }),
        })}
      />,
    );

    expect(screen.getByText("No recent match")).toBeInTheDocument();
    expect(
      screen.queryByText("Match data unavailable"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("match-card")).toHaveLength(1);
  });

  it("shows 'No upcoming match' when only the last match is present", () => {
    render(
      <EntityCard
        entity={makeEntity({ lastMatch: makeMatch({ id: "m1" }) })}
      />,
    );
    expect(screen.getByText("No upcoming match")).toBeInTheDocument();
  });

  it("renders the crest when the entity has one", () => {
    const { container } = render(
      <EntityCard
        entity={makeEntity({ badgeUrl: "https://example.test/crest.png" })}
      />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.test/crest.png");
  });
});
