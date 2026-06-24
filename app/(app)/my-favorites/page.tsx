import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import type { FavoriteRow } from "@/db/schema/favorites";
import type { FavoriteType } from "@/lib/sports/types";
import { FavoriteRemoveButton } from "@/components/favorite-remove-button";

export const metadata: Metadata = {
  title: "My Favorites · ScoreMate",
};

const SECTION_ORDER: readonly FavoriteType[] = [
  "team",
  "league",
  "sport",
  "event",
];

const SECTION_LABEL: Record<FavoriteType, string> = {
  team: "Teams",
  league: "Leagues",
  sport: "Sports",
  event: "Tournaments",
};

function groupByType(rows: FavoriteRow[]): Record<FavoriteType, FavoriteRow[]> {
  const out: Record<FavoriteType, FavoriteRow[]> = {
    team: [],
    sport: [],
    league: [],
    event: [],
  };
  for (const r of rows) out[r.type].push(r);
  return out;
}

export default async function MyFavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const favorites = await listFavoritesForUser(session.user.id);

  if (favorites.length === 0) {
    return (
      <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-4 pt-8">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            My Favorites
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            You haven&apos;t favorited anything yet — go to{" "}
            <Link href="/favorites" className="font-medium underline">
              Favorites
            </Link>{" "}
            to add some.
          </p>
        </div>
      </main>
    );
  }

  const groups = groupByType(favorites);

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 pt-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            My Favorites
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {favorites.length}{" "}
            {favorites.length === 1 ? "favorite" : "favorites"}.
          </p>
        </header>

        {SECTION_ORDER.map((type) => {
          const rows = groups[type];
          if (rows.length === 0) return null;
          return (
            <section key={type} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                {SECTION_LABEL[type]}
              </h2>
              <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-base font-medium">
                        {row.displayName}
                      </span>
                      <span className="text-xs text-zinc-500">{row.sport}</span>
                    </div>
                    <FavoriteRemoveButton
                      favoriteId={row.id}
                      displayName={row.displayName}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
