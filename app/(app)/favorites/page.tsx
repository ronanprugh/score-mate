import type { Metadata } from "next";
import { auth } from "@/auth";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import { FavoritesSearch } from "@/components/favorites-search";

export const metadata: Metadata = {
  title: "Favorites · ScoreMate",
};

/**
 * Search/browse screen. The (app) layout already gates auth, so we can
 * trust `session.user.id` here. Loads the user's existing favorites once
 * so we can mark search results as "Added" without a second round-trip.
 */
export default async function FavoritesPage() {
  const session = await auth();
  // Layout's redirect makes this unreachable when session is null, but TS
  // doesn't know — guard anyway.
  if (!session?.user?.id) return null;

  const existing = await listFavoritesForUser(session.user.id);
  const initialFavorites = existing.map((f) => ({
    type: f.type,
    externalId: f.externalId,
  }));

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 pt-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            Add a favorite
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Find a team, league, sport, or tournament and tap Add.
          </p>
        </header>
        <FavoritesSearch initialFavorites={initialFavorites} />
      </div>
    </main>
  );
}
