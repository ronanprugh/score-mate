import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HomeClient } from "@/components/home-client";
import { listFavoritesForUser } from "@/lib/favorites/queries";

export const metadata: Metadata = {
  title: "Home · ScoreMate",
};

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const favorites = await listFavoritesForUser(session.user.id);

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 pt-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            Your matches
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Yesterday, today, and tomorrow — for the teams, leagues, sports, and
            tournaments you follow.
          </p>
        </header>
        <HomeClient hasFavorites={favorites.length > 0} />
      </div>
    </main>
  );
}
