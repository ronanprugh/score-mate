import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Check your email · ScoreMate",
};

/**
 * Static fallback for Auth.js's `verifyRequest` callback. Reached when a
 * magic-link sign-in is initiated directly via Auth.js's hosted flow (rather
 * than via `<SigninForm />`, which renders its own in-place confirmation).
 */
export default function CheckEmailPage() {
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
        We sent you a sign-in link. Click the link in that email to finish
        signing in. The link expires in 24 hours and can only be used once.
      </p>
      <Link
        href="/signin"
        className="inline-flex min-h-11 min-w-11 items-center justify-center self-start rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Back to sign in
      </Link>
    </section>
  );
}
