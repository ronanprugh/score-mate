import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign-in error · ScoreMate",
};

/**
 * Auth.js error page. Mapped to the Auth.js `?error=<code>` query param via
 * `pages.error` in `auth.config.ts`. Maps Auth.js's machine codes to short,
 * non-technical user-facing messages.
 *
 * The list of codes mirrors Auth.js v5's documented error names:
 *   https://authjs.dev/reference/core/errors
 */
type ErrorMessage = {
  title: string;
  description: string;
};

const MESSAGES: Record<string, ErrorMessage> = {
  OAuthCallback: {
    title: "Google sign-in didn't complete",
    description:
      "Google didn't return us back to ScoreMate. This can happen if you closed the popup or denied access. Try again, or use the email option instead.",
  },
  Verification: {
    title: "That sign-in link is no longer valid",
    description:
      "Magic-link emails can only be used once and expire after 24 hours. Request a new link to continue.",
  },
  EmailSignin: {
    title: "We couldn't send your sign-in email",
    description:
      "The email provider rejected the request. Double-check the address and try again — if it keeps failing, try Google sign-in.",
  },
  Default: {
    title: "Something went wrong with sign-in",
    description:
      "Please try again. If the problem persists, try the other sign-in option.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message: ErrorMessage =
    (error ? MESSAGES[error] : undefined) ?? MESSAGES.Default!;

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <section
        role="alert"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6"
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight">
            {message.title}
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            {message.description}
          </p>
        </header>
        <Link
          href="/signin"
          className="inline-flex min-h-11 min-w-11 w-full items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
