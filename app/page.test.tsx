import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

describe("Landing page", () => {
  it("renders the product name and a sign-in entry point", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { name: /scoremate/i, level: 1 }),
    ).toBeInTheDocument();

    const signIn = screen.getByRole("link", {
      name: /sign in to get started/i,
    });
    expect(signIn).toBeInTheDocument();
    expect(signIn).toHaveAttribute("href", "/signin");
  });

  it("uses a Tailwind class that satisfies the 44px touch-target rule on the primary CTA", () => {
    render(<LandingPage />);
    const signIn = screen.getByRole("link", {
      name: /sign in to get started/i,
    });
    // min-h-11 = 2.75rem = 44px (Tailwind default scale).
    expect(signIn.className).toMatch(/\bmin-h-11\b/);
    expect(signIn.className).toMatch(/\bmin-w-11\b/);
  });
});
