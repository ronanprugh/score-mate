import type { Metadata } from "next";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/account-menu";

export const metadata: Metadata = {
  title: "Settings · ScoreMate",
};

/**
 * Settings screen. The (app) layout already gates auth, so we can trust
 * `session.user` here. Surfaces the signed-in identity + Sign out (the
 * `AccountMenu`) and a short app-info line. Account management (profile
 * editing, deletion, etc.) is intentionally out of scope (Spec 01).
 */
export default async function SettingsPage() {
  const session = await auth();
  // Layout's redirect makes this unreachable when session is null, but TS
  // doesn't know — guard anyway.
  if (!session?.user) return null;

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 pt-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          Settings
        </h1>

        <AccountMenu
          email={session.user.email ?? ""}
          name={session.user.name ?? null}
        />

        <section aria-label="About" className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            About
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ScoreMate — your favorite teams, leagues, and tournaments in one
            live feed.
          </p>
        </section>
      </div>
    </main>
  );
}
