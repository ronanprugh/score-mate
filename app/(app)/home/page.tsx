import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/account-menu";

export const metadata: Metadata = {
  title: "Home · ScoreMate",
};

/**
 * Placeholder authenticated home. Confirms the user is signed in and
 * surfaces an account menu with a sign-out affordance.
 *
 * NOTE: This page is intentionally minimal. The favorites browser, "My
 * Favorites" screen, and the yesterday/today/tomorrow score-tracker
 * homepage belong to `02-spec-score-tracker` and must NOT be added here.
 */
export default async function HomePage() {
  const session = await auth();

  // Middleware already redirects unauthenticated visitors based on cookie
  // presence. This call validates the actual session against the DB and
  // catches the case where the cookie exists but the session is expired
  // or revoked.
  if (!session?.user) {
    redirect("/signin");
  }

  const { email, name } = session.user;
  if (!email) {
    // Should never happen — Auth.js requires a verified email for either
    // provider — but if it does, treat it as unauthenticated.
    redirect("/signin");
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 pt-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Welcome, {name ?? email.split("@")[0]}
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Your score tracker will live here. For now, this is just the
            signed-in placeholder.
          </p>
        </header>
        <AccountMenu email={email} name={name ?? null} />
      </div>
    </main>
  );
}
