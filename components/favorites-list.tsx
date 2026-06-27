import type { FavoriteRow } from "@/db/schema/favorites";
import type { FavoriteType } from "@/lib/sports/types";
import { FavoriteRemoveButton } from "@/components/favorite-remove-button";

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

/**
 * Renders the user's saved favorites grouped by type (Teams / Leagues /
 * Sports / Tournaments), each row carrying a `FavoriteRemoveButton`. Shows a
 * lightweight empty state when there are no favorites. Pure presentational —
 * no data fetching — so it can sit on the unified Favorites page below the
 * search/add section.
 */
export function FavoritesList({ favorites }: { favorites: FavoriteRow[] }) {
  if (favorites.length === 0) {
    return (
      <p
        data-testid="favorites-empty"
        className="text-sm text-zinc-600 dark:text-zinc-400"
      >
        You haven&apos;t favorited anything yet — use the search above to add
        some.
      </p>
    );
  }

  const groups = groupByType(favorites);

  return (
    <div className="flex flex-col gap-8">
      {SECTION_ORDER.map((type) => {
        const rows = groups[type];
        if (rows.length === 0) return null;
        return (
          <section key={type} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {SECTION_LABEL[type]}
            </h3>
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
  );
}
