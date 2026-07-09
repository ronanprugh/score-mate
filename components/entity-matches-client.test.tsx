import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Match } from "@/lib/sports/types";
import type { EntityMatchesEnvelope } from "@/lib/teams/types";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

import { EntityMatchesClient } from "./entity-matches-client";

function makeMatch(over: Partial<Match>): Match {
  return {
    id: over.id ?? "evt",
    sport: "Soccer",
    homeTeamId: "1",
    homeTeamName: "Arsenal",
    awayTeamId: "2",
    awayTeamName: "Chelsea",
    leagueId: "soccer/eng.1",
    leagueName: "English Premier League",
    dateUtc: "2026-06-24",
    kickoffUtc: "2026-06-24T19:30:00Z",
    status: "upcoming",
    ...over,
  };
}

function envelope(
  over: Partial<EntityMatchesEnvelope> = {},
): EntityMatchesEnvelope {
  return {
    entity: {
      favoriteId: "fav-1",
      displayName: "Arsenal",
      type: "team",
      sport: "Soccer",
    },
    recent: [],
    upcoming: [],
    source: { ok: true, errors: [] },
    ...over,
  };
}

function mockFetchOnce(body: unknown, ok = true) {
  fetchMock.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response);
}

describe("EntityMatchesClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    // jsdom doesn't implement scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("fetches /api/teams/[favoriteId]/matches on mount", async () => {
    mockFetchOnce(envelope());
    render(<EntityMatchesClient favoriteId="fav-1" displayName="Arsenal" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/api/teams/fav-1/matches");
  });

  it("orders matches past -> future with a divider between completed and upcoming", async () => {
    mockFetchOnce(
      envelope({
        // API returns recent most-recent-first.
        recent: [
          makeMatch({ id: "r-newest", status: "final", dateUtc: "2026-06-20" }),
          makeMatch({ id: "r-oldest", status: "final", dateUtc: "2026-06-01" }),
        ],
        upcoming: [
          makeMatch({
            id: "u-soonest",
            status: "upcoming",
            dateUtc: "2026-07-01",
          }),
          makeMatch({
            id: "u-latest",
            status: "upcoming",
            dateUtc: "2026-07-10",
          }),
        ],
      }),
    );
    render(<EntityMatchesClient favoriteId="fav-1" displayName="Arsenal" />);

    await screen.findByTestId("entity-matches-list");
    const cards = screen.getAllByTestId("match-card");
    // Rendered order: oldest recent -> newest recent -> (divider) -> soonest upcoming -> latest upcoming.
    expect(cards.map((c) => c.getAttribute("data-status"))).toEqual([
      "final",
      "final",
      "upcoming",
      "upcoming",
    ]);
    expect(screen.getByTestId("entity-matches-divider")).toBeInTheDocument();
  });

  it("routes Tennis matches to TennisMatchCard and other sports to MatchCard", async () => {
    mockFetchOnce(
      envelope({
        recent: [
          makeMatch({
            id: "t-1",
            sport: "Tennis",
            status: "final",
            tennis: {
              home: { sets: [{ games: 6, won: true }], won: true },
              away: { sets: [{ games: 4, won: false }], won: false },
            },
          }),
        ],
        upcoming: [makeMatch({ id: "m-1", sport: "Soccer" })],
      }),
    );
    render(<EntityMatchesClient favoriteId="fav-2" displayName="Sinner" />);

    await screen.findByTestId("entity-matches-list");
    expect(screen.getAllByTestId("match-card")).toHaveLength(2);
  });

  it("shows 'No recent matches' when recent is empty but upcoming has matches", async () => {
    mockFetchOnce(
      envelope({ upcoming: [makeMatch({ id: "u-1", status: "upcoming" })] }),
    );
    render(<EntityMatchesClient favoriteId="fav-1" displayName="Arsenal" />);

    await screen.findByText("No recent matches");
    expect(screen.getAllByTestId("match-card")).toHaveLength(1);
  });

  it("shows 'No upcoming matches' when upcoming is empty but recent has matches", async () => {
    mockFetchOnce(
      envelope({ recent: [makeMatch({ id: "r-1", status: "final" })] }),
    );
    render(<EntityMatchesClient favoriteId="fav-1" displayName="Arsenal" />);

    await screen.findByText("No upcoming matches");
    expect(screen.getAllByTestId("match-card")).toHaveLength(1);
  });

  it("shows a single 'Match data unavailable' message when both are empty", async () => {
    mockFetchOnce(envelope());
    render(<EntityMatchesClient favoriteId="fav-1" displayName="Arsenal" />);

    await screen.findByTestId("entity-matches-unavailable");
    expect(screen.getByText("Match data unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("entity-matches-list")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("entity-matches-divider"),
    ).not.toBeInTheDocument();
  });

  it("scrolls the most recent completed match into view on mount", async () => {
    mockFetchOnce(
      envelope({
        recent: [
          makeMatch({ id: "r-newest", status: "final", dateUtc: "2026-06-20" }),
          makeMatch({ id: "r-oldest", status: "final", dateUtc: "2026-06-01" }),
        ],
        upcoming: [makeMatch({ id: "u-1", status: "upcoming" })],
      }),
    );
    render(<EntityMatchesClient favoriteId="fav-1" displayName="Arsenal" />);

    await screen.findByTestId("entity-matches-list");
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled(),
    );
  });

  it("shows a data-source error banner when source.ok is false", async () => {
    mockFetchOnce(envelope({ source: { ok: false, errors: ["ESPN 500"] } }));
    render(<EntityMatchesClient favoriteId="fav-1" displayName="Arsenal" />);

    await screen.findByTestId("data-source-error-banner");
  });
});
