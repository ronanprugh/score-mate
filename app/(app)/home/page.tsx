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
  // Team/player favorites live on the Teams tab, so a user whose only
  // favorites are teams/players has "favorites" but no *league* favorites
  // feeding the home feed.
  const hasLeagueFavorites = favorites.some(
    (f) => f.type !== "team" && f.type !== "player",
  );

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        <HomeClient
          hasFavorites={favorites.length > 0}
          hasLeagueFavorites={hasLeagueFavorites}
        />
      </div>
    </main>
  );
}
