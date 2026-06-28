import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
  // Sign-out server action dependency; not invoked in these render tests.
  signOut: vi.fn(),
}));

import SettingsPage from "./page";

const SESSION = {
  user: { id: "user-a", email: "ada@example.com", name: "Ada Lovelace" },
};

describe("SettingsPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(SESSION);
  });

  it("renders the signed-in identity and a working Sign-out control", async () => {
    render(await SettingsPage());

    // Identity (display name + email).
    expect(screen.getByTestId("account-display-name")).toHaveTextContent(
      "Ada Lovelace",
    );
    expect(screen.getByTestId("account-email")).toHaveTextContent(
      "ada@example.com",
    );

    // Sign-out control: a button inside a form (wired to the server action).
    const button = screen.getByRole("button", { name: /sign out/i });
    expect(button).toBeInTheDocument();
    expect(button.closest("form")).not.toBeNull();
  });

  it("renders an app-info line", async () => {
    render(await SettingsPage());
    expect(screen.getByText(/scoremate/i)).toBeInTheDocument();
  });

  it("falls back to the email as display name when no name is set", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-b", email: "noname@example.com", name: null },
    });
    render(await SettingsPage());
    expect(screen.getByTestId("account-display-name")).toHaveTextContent(
      "noname@example.com",
    );
  });

  it("returns null when there's no session — layout should have redirected", async () => {
    authMock.mockResolvedValue(null);
    const ui = await SettingsPage();
    expect(ui).toBeNull();
  });
});
