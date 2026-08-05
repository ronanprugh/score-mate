import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { TeamsEnvelope } from "@/lib/teams/types";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

import { TeamsClient } from "./teams-client";

const EMPTY_ENVELOPE: TeamsEnvelope = {
  entities: [],
  source: { ok: true, errors: [] },
};

describe("TeamsClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("fetches /api/teams on mount", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => EMPTY_ENVELOPE,
    } as Response);

    render(<TeamsClient />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/api/teams");
  });

  it("aborts the in-flight request on unmount", async () => {
    let capturedSignal: AbortSignal | null = null;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? null;
      return new Promise(() => {
        /* never resolves */
      });
    });

    const { unmount } = render(<TeamsClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.aborted).toBe(false);

    unmount();
    expect(capturedSignal!.aborted).toBe(true);
  });

  it("lays entities out in a single column at every breakpoint", async () => {
    // Spec 13, Unit 3 FR3. A 375px screenshot alone would also pass for a grid
    // that merely stacks on mobile, so assert the responsive column classes
    // are gone rather than just overridden.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        entities: [
          {
            favoriteId: "fav-1",
            displayName: "Liverpool",
            type: "team",
            sport: "Soccer",
            lastMatch: null,
            nextMatch: null,
          },
        ],
        source: { ok: true, errors: [] },
      }),
    } as Response);

    const { findByTestId } = render(<TeamsClient />);
    const list = await findByTestId("entity-list");

    expect(list.className).not.toMatch(/\bsm:grid-cols-/);
    expect(list.className).not.toMatch(/\bmd:grid-cols-/);
    expect(list.className).not.toMatch(/\blg:grid-cols-/);
    expect(list.className).toContain("flex-col");
  });
});
