"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Client-side sign-in form. Renders the two primary CTAs ("Continue with
 * Google" and "Continue with Email") plus the email input. After a magic
 * link is requested, transitions to a "Check your email" confirmation state.
 *
 * Both buttons satisfy the spec's 44×44px touch-target rule via the Tailwind
 * `min-h-11 min-w-11` utilities (`h-11` = 2.75rem ≈ 44px).
 */
export function SigninForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleGoogle() {
    setErrorMessage(null);
    startTransition(async () => {
      await signIn("google", { callbackUrl: "/home" });
    });
  }

  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    if (!email) return;
    setStatus("sending");
    const result = await signIn("resend", {
      email,
      redirect: false,
      callbackUrl: "/home",
    });
    if (result?.error) {
      setStatus("error");
      setErrorMessage(
        "We couldn't send the sign-in link. Please double-check the email and try again.",
      );
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <section
        aria-live="polite"
        className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          We sent a sign-in link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click
          the link in that email to finish signing in. The link expires in 24
          hours and can only be used once.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center self-start rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Use a different email
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={isPending}
        className="inline-flex min-h-11 min-w-11 w-full items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        Continue with Google
      </button>

      <div
        className="flex items-center gap-3 text-sm text-zinc-500"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        <span>or</span>
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form onSubmit={handleEmail} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-11 w-full rounded-lg border border-zinc-300 bg-background px-4 text-base outline-none focus:border-zinc-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={status === "sending" || !email}
          className="inline-flex min-h-11 min-w-11 w-full items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {status === "sending" ? "Sending link…" : "Continue with Email"}
        </button>
        {errorMessage && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}
