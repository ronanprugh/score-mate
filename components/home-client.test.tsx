import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Match } from "@/lib/sportsdb/types";
import type { HomeEnvelope } from "@/lib/home/aggregator";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

import { HomeClient } from "./home-client";

function makeMatch(over: Partial<Match>): Match {
  return {
    id: over.id ?? "evt",
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: over.homeTeamName ?? "Home",
    awayTeamId: "a",
    awayTeamName: over.awayTeamName ?? "Away",
    leagueId: "4328",
    leagueName: "EPL",
    dateUtc: over.dateUtc ?? "2026-06-24",
    kickoffUtc: over.kickoffUtc ?? "2026-06-24T19:30:00Z",
    status: over.status ?? "upcoming",
    ...over,
  };
}

function envelope(
  partial: Partial<HomeEnvelope> & { okFailedCount?: number },
): HomeEnvelope {
  return {
    yesterday: partial.yesterday ?? [],
    today: partial.today ?? [],
    tomorrow: partial.tomorrow ?? [],
    source:
      partial.source ??
      (partial.okFailedCount !== undefined
        ? { ok: false, errors: Array(partial.okFailedCount).fill("boom") }
        : { ok: true, errors: [] }),
  };
}

function mockJson(env: HomeEnvelope) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => env,
  } as Response);
}

describe("HomeClient (static cases)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("renders three day sections when matches exist", async () => {
    mockJson(
      envelope({
        yesterday: [makeMatch({ id: "y", homeTeamName: "Y-home" })],
        today: [makeMatch({ id: "t", homeTeamName: "T-home" })],
        tomorrow: [makeMatch({ id: "m", homeTeamName: "M-home" })],
      }),
    );

    render(<HomeClient hasFavorites={true} />);

    await waitFor(() =>
      expect(screen.getByTestId("day-section-yesterday")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("day-section-today")).toBeInTheDocument();
    expect(screen.getByTestId("day-section-tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Y-home")).toBeInTheDocument();
  });

  it("shows the no-matches empty state when user has favorites but no matches", async () => {
    mockJson(envelope({}));
    render(<HomeClient hasFavorites={true} />);
    await waitFor(() =>
      expect(screen.getByTestId("no-matches-empty")).toBeInTheDocument(),
    );
  });

  it("shows the no-favorites prompt when user has no favorites", async () => {
    mockJson(envelope({}));
    render(<HomeClient hasFavorites={false} />);
    await waitFor(() =>
      expect(screen.getByTestId("no-favorites-prompt")).toBeInTheDocument(),
    );
  });

  it("renders the data-source error banner when source.ok is false", async () => {
    mockJson(
      envelope({
        today: [makeMatch({ id: "t" })],
        okFailedCount: 2,
      }),
    );
    render(<HomeClient hasFavorites={true} />);
    await waitFor(() =>
      expect(
        screen.getByTestId("data-source-error-banner"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("data-source-error-banner")).toHaveTextContent(
      /2 requests failed/i,
    );
  });
});
