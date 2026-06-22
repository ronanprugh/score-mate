import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthErrorPage from "./page";

async function renderWithError(code: string | undefined) {
  const ui = await AuthErrorPage({
    searchParams: Promise.resolve(code ? { error: code } : {}),
  });
  render(ui);
}

describe("Auth error page", () => {
  it("renders a distinct, non-technical message for OAuthCallback", async () => {
    await renderWithError("OAuthCallback");
    expect(
      screen.getByRole("heading", { name: /google sign-in didn't complete/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/closed the popup/i)).toBeInTheDocument();
    expect(screen.queryByText(/OAuthCallback/)).not.toBeInTheDocument();
  });

  it("renders a distinct, non-technical message for Verification", async () => {
    await renderWithError("Verification");
    expect(
      screen.getByRole("heading", { name: /no longer valid/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/expire after 24 hours/i)).toBeInTheDocument();
    expect(screen.queryByText(/Verification/)).not.toBeInTheDocument();
  });

  it("renders a distinct, non-technical message for EmailSignin", async () => {
    await renderWithError("EmailSignin");
    expect(
      screen.getByRole("heading", {
        name: /couldn't send your sign-in email/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/email provider rejected/i)).toBeInTheDocument();
    expect(screen.queryByText(/EmailSignin/)).not.toBeInTheDocument();
  });

  it("falls back to the Default message for unknown error codes", async () => {
    await renderWithError("SomethingNewFromAuthJs");
    expect(
      screen.getByRole("heading", { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  it("includes a back-to-signin link in every branch", async () => {
    await renderWithError("Verification");
    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link).toHaveAttribute("href", "/signin");
  });
});
