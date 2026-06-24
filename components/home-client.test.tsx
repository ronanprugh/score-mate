import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Match } from "@/lib/sports/types";
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

  it("renders all three day tabs and defaults to Today (only today's matches in the panel)", async () => {
    mockJson(
      envelope({
        yesterday: [makeMatch({ id: "y", homeTeamName: "Y-home" })],
        today: [makeMatch({ id: "t", homeTeamName: "T-home" })],
        tomorrow: [makeMatch({ id: "m", homeTeamName: "M-home" })],
      }),
    );

    render(<HomeClient hasFavorites={true} />);

    await waitFor(() =>
      expect(screen.getByTestId("day-tab-today")).toBeInTheDocument(),
    );
    // All three tabs rendered.
    expect(screen.getByTestId("day-tab-yesterday")).toBeInTheDocument();
    expect(screen.getByTestId("day-tab-tomorrow")).toBeInTheDocument();
    // Today is the default active tab.
    expect(screen.getByTestId("day-tab-today")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Only the today panel + today's match is in the DOM by default.
    expect(screen.getByTestId("day-panel-today")).toBeInTheDocument();
    expect(screen.getByText("T-home")).toBeInTheDocument();
    expect(screen.queryByText("Y-home")).not.toBeInTheDocument();
    expect(screen.queryByText("M-home")).not.toBeInTheDocument();
  });

  it("groups matches within a tab by leagueName with a heading per group", async () => {
    mockJson(
      envelope({
        today: [
          makeMatch({
            id: "epl-1",
            homeTeamName: "Arsenal",
            leagueId: "4328",
            leagueName: "English Premier League",
            kickoffUtc: "2026-06-24T15:00:00Z",
          }),
          makeMatch({
            id: "epl-2",
            homeTeamName: "Chelsea",
            leagueId: "4328",
            leagueName: "English Premier League",
            kickoffUtc: "2026-06-24T17:30:00Z",
          }),
          makeMatch({
            id: "wc-1",
            homeTeamName: "USA",
            leagueId: "4429",
            leagueName: "FIFA World Cup",
            kickoffUtc: "2026-06-24T20:00:00Z",
          }),
        ],
      }),
    );
    render(<HomeClient hasFavorites={true} />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "English Premier League" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "FIFA World Cup" }),
    ).toBeInTheDocument();
    // EPL group comes first (earlier kickoff in group).
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "English Premier League",
      "FIFA World Cup",
    ]);
  });

  it("clicking a tab swaps the rendered panel", async () => {
    mockJson(
      envelope({
        yesterday: [makeMatch({ id: "y", homeTeamName: "Y-home" })],
        today: [makeMatch({ id: "t", homeTeamName: "T-home" })],
        tomorrow: [makeMatch({ id: "m", homeTeamName: "M-home" })],
      }),
    );
    render(<HomeClient hasFavorites={true} />);
    await waitFor(() => expect(screen.getByText("T-home")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("day-tab-yesterday"));
    expect(screen.getByTestId("day-tab-yesterday")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Y-home")).toBeInTheDocument();
    expect(screen.queryByText("T-home")).not.toBeInTheDocument();
  });

  it("each tab is a 44 px tap target", async () => {
    mockJson(envelope({ today: [makeMatch({ id: "t" })] }));
    render(<HomeClient hasFavorites={true} />);
    await waitFor(() =>
      expect(screen.getByTestId("day-tab-today")).toBeInTheDocument(),
    );
    for (const key of ["yesterday", "today", "tomorrow"]) {
      const btn = screen.getByTestId(`day-tab-${key}`);
      expect(btn.className).toMatch(/\bmin-h-11\b/);
    }
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

describe("HomeClient (polling + visibility)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  function liveEnvelope(): HomeEnvelope {
    return envelope({
      today: [
        makeMatch({
          id: "live1",
          status: "live",
          homeScore: 1,
          awayScore: 0,
          liveProgress: "32'",
        }),
      ],
    });
  }

  function finalEnvelope(): HomeEnvelope {
    return envelope({
      today: [
        makeMatch({
          id: "f1",
          status: "final",
          homeScore: 2,
          awayScore: 1,
        }),
      ],
    });
  }

  it("polls /api/home every 60s while ≥1 live match is on screen", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => liveEnvelope(),
    } as Response);

    render(<HomeClient hasFavorites={true} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not poll when no live matches are present", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => finalEnvelope(),
    } as Response);

    render(<HomeClient hasFavorites={true} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pauses polling when the tab becomes hidden and resumes on visible", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => liveEnvelope(),
    } as Response);

    render(<HomeClient hasFavorites={true} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    // Tab hidden — no polling, even past 60s.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Tab visible — refetch immediately, then resume 60s polling.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("aborts in-flight fetches on unmount", async () => {
    let capturedSignal: AbortSignal | null = null;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? null;
      return new Promise(() => {
        /* never resolves */
      });
    });

    const { unmount } = render(<HomeClient hasFavorites={true} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.aborted).toBe(false);

    unmount();
    expect(capturedSignal!.aborted).toBe(true);
  });
});
