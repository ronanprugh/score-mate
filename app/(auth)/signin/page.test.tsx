import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock next-auth/react before importing the form. SessionProvider is
// rendered by SigninForm purely to set the client basePath, so a
// pass-through stub is sufficient here.
const signInMock = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { SigninForm } from "@/components/signin-form";

describe("Sign-in form", () => {
  beforeEach(() => {
    signInMock.mockReset();
  });

  it("renders both Google and email provider CTAs", () => {
    render(<SigninForm />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with email/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("primary buttons satisfy the 44px touch-target rule via min-h-11/min-w-11 utilities", () => {
    render(<SigninForm />);
    const google = screen.getByRole("button", {
      name: /continue with google/i,
    });
    const email = screen.getByRole("button", { name: /continue with email/i });
    for (const el of [google, email]) {
      expect(el.className).toMatch(/\bmin-h-11\b/);
      expect(el.className).toMatch(/\bmin-w-11\b/);
    }
  });

  it("calls signIn('google') with a basePath-prefixed callbackUrl when the Google CTA is clicked", async () => {
    signInMock.mockResolvedValue(undefined);
    render(<SigninForm />);
    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith("google", {
        callbackUrl: "/ScoreMate/home",
      });
    });
  });

  it("transitions to the 'Check your email' confirmation after a successful magic-link request", async () => {
    signInMock.mockResolvedValue({ ok: true, error: null });
    render(<SigninForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue with email/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /check your email/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    expect(signInMock).toHaveBeenCalledWith("resend", {
      email: "test@example.com",
      redirect: false,
      callbackUrl: "/ScoreMate/home",
    });
  });

  it("shows a non-technical error message when the email provider fails", async () => {
    signInMock.mockResolvedValue({ ok: false, error: "EmailSignin" });
    render(<SigninForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "bad@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /continue with email/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't send/i);
    });
    // No raw Auth.js error code leaked to the user.
    expect(screen.queryByText(/EmailSignin/)).not.toBeInTheDocument();
  });
});
