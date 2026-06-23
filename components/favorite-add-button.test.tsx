import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

import { FavoriteAddButton } from "./favorite-add-button";

const PAYLOAD = {
  type: "team" as const,
  externalId: "133604",
  displayName: "Arsenal",
  sport: "Soccer" as const,
};

describe("FavoriteAddButton", () => {
  beforeEach(() => fetchMock.mockReset());

  it("renders an enabled 'Add' button when initialAdded is false", () => {
    render(<FavoriteAddButton payload={PAYLOAD} initialAdded={false} />);
    const btn = screen.getByRole("button", {
      name: /add arsenal to favorites/i,
    });
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent(/^add$/i);
  });

  it("renders a disabled 'Added' button when initialAdded is true", () => {
    render(<FavoriteAddButton payload={PAYLOAD} initialAdded={true} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/added/i);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("POSTs the payload and transitions to 'Added' on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ favorite: { id: "fav-1" }, existed: false }),
    } as Response);

    render(<FavoriteAddButton payload={PAYLOAD} initialAdded={false} />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent(/added/i);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/favorites",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(PAYLOAD),
      }),
    );
  });

  it("rolls back and shows a non-technical error on 429", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate_limited" }),
    } as Response);

    render(<FavoriteAddButton payload={PAYLOAD} initialAdded={false} />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/too fast/i);
    });
    // Button is back to Add (not Added).
    expect(screen.getByRole("button")).toHaveTextContent(/^add$/i);
    // No raw error code leaked.
    expect(screen.queryByText(/rate_limited/)).not.toBeInTheDocument();
  });

  it("satisfies the 44×44 touch-target rule", () => {
    render(<FavoriteAddButton payload={PAYLOAD} initialAdded={false} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/\bmin-h-11\b/);
    expect(btn.className).toMatch(/\bmin-w-11\b/);
  });
});
