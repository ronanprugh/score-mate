/**
 * Dev-only fixture for Spec 07 screenshots. Renders the unified Favorites
 * layout (and, in later tasks, the Settings/account block and bottom nav)
 * with placeholder data so auth-gated screens can be captured without a
 * session. NOT linked from `BottomNav` or any production route.
 */
import type { FavoriteRow } from "@/db/schema/favorites";
import { FavoritesSearch } from "@/components/favorites-search";
import { FavoritesList } from "@/components/favorites-list";

const row = (
  id: string,
  type: FavoriteRow["type"],
  displayName: string,
  sport: FavoriteRow["sport"],
): FavoriteRow => ({
  id,
  userId: "fixture-user",
  type,
  externalId: `ext-${id}`,
  displayName,
  sport,
  metadata: null,
  createdAt: new Date("2026-06-22T12:00:00Z"),
});

const FIXTURE_FAVORITES: FavoriteRow[] = [
  row("1", "team", "Arsenal", "Soccer"),
  row("2", "team", "Kansas City Chiefs", "American Football"),
  row("3", "league", "Premier League", "Soccer"),
  row("4", "sport", "Basketball", "Basketball"),
  row("5", "event", "FIFA World Cup 2026", "Soccer"),
];

export default function NavFixture() {
  return (
    <main className="flex flex-1 flex-col px-5 pt-6">
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
          <FavoritesSearch initialFavorites={[]} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold leading-tight">
            Your favorites
          </h2>
          <FavoritesList favorites={FIXTURE_FAVORITES} />
        </section>
      </div>
    </main>
  );
}
