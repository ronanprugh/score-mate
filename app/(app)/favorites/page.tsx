import type { Metadata } from "next";
import { auth } from "@/auth";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import { FavoritesSearch } from "@/components/favorites-search";
import { FavoritesList } from "@/components/favorites-list";

export const metadata: Metadata = {
  title: "Favorites · ScoreMate",
};

/**
 * Unified Favorites screen: search/add at the top, the user's saved favorites
 * (grouped by type, each removable) below — one place to both add and manage.
 * The (app) layout already gates auth, so we can trust `session.user.id`.
 * Favorites are loaded once and fed to both the search (to mark "Added") and
 * the saved list.
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 pt-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          Favorites
        </h1>

        <section className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold leading-tight">
              Add a favorite
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Find a team, league, sport, or tournament and tap Add.
            </p>
          </header>
          <FavoritesSearch initialFavorites={initialFavorites} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold leading-tight">
            Your favorites
          </h2>
          <FavoritesList favorites={existing} />
        </section>
      </div>
    </main>
  );
}
