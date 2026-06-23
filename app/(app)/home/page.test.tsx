import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// next/navigation's `redirect` throws a Next-specific error to abort
// rendering. We need to catch it in the test so we can assert it ran with
// the expected path.
class RedirectError extends Error {
  constructor(public readonly path: string) {
    super(`__REDIRECT__:${path}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new RedirectError(path);
  },
}));

// Mock the AccountMenu so we don't have to render the server-action form
// (which is awkward inside vitest). We assert its props are correct.
vi.mock("@/components/account-menu", () => ({
  AccountMenu: ({ email, name }: { email: string; name: string | null }) => (
    <div data-testid="account-menu" data-email={email} data-name={name ?? ""}>
      AccountMenu
    </div>
  ),
}));

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

import HomePage from "./page";

describe("Home page (gated)", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("redirects to /signin when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(HomePage()).rejects.toThrow(/__REDIRECT__:\/signin/);
  });

  it("redirects to /signin when the session has no user", async () => {
    authMock.mockResolvedValue({ user: undefined });
    await expect(HomePage()).rejects.toThrow(/__REDIRECT__:\/signin/);
  });

  it("redirects to /signin when the session has no email", async () => {
    authMock.mockResolvedValue({ user: { name: "Alice" } });
    await expect(HomePage()).rejects.toThrow(/__REDIRECT__:\/signin/);
  });

  it("renders the welcome heading and account menu when signed in", async () => {
    authMock.mockResolvedValue({
      user: { email: "alice@example.com", name: "Alice" },
    });
    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /welcome, alice/i, level: 1 }),
    ).toBeInTheDocument();

    const menu = screen.getByTestId("account-menu");
    expect(menu).toHaveAttribute("data-email", "alice@example.com");
    expect(menu).toHaveAttribute("data-name", "Alice");
  });

  it("falls back to the email local-part when no display name is present", async () => {
    authMock.mockResolvedValue({
      user: { email: "bob@example.com", name: null },
    });
    const ui = await HomePage();
    render(ui);
    expect(
      screen.getByRole("heading", { name: /welcome, bob/i, level: 1 }),
    ).toBeInTheDocument();
  });
});
