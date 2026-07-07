import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listFavoritesForUser } from "@/lib/favorites/queries";

export const metadata: Metadata = {
  title: "Teams · ScoreMate",
};

/**
 * Teams destination: shows one entity card per followed team/player with their
 * last and next match. When the user follows no team or player favorites, we
 * render an empty state pointing them at the Favorites screen.
 *
 * NOTE: the data-driven `TeamsClient` is wired up in Task 2.0. For now the
 * "has favorites" branch renders a loading placeholder.
 */
export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const favorites = await listFavoritesForUser(session.user.id);
  // "player" is added to the FavoriteType union in Task 3.0; this check is
  // broadened to include it then.
  const hasEntityFavorites = favorites.some((f) => f.type === "team");

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        {hasEntityFavorites ? (
          <p
            className="text-sm text-zinc-500"
            aria-live="polite"
            data-testid="teams-loading"
          >
            Loading teams…
          </p>
        ) : (
          <TeamsEmptyState />
        )}
      </div>
    </main>
  );
}

function TeamsEmptyState() {
  return (
    <section
      role="status"
      data-testid="teams-empty-prompt"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-zinc-200 px-6 py-10 text-center dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">Follow a team or player</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Favorite a team or player and their last and next match will show up
        here.
      </p>
      <a
        href="/favorites"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
      >
        Add a team or player
      </a>
    </section>
  );
}
