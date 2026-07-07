/**
 * Dev-only fixture page for Spec 09 Task 3.0 screenshots.
 * Renders the favorites search UI pre-populated with a Player result so the
 * player-search flow can be captured without a live session or ESPN call.
 * NOT linked from any production route or navigation.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fixture: Player search",
};

const PLAYER_RESULTS = [
  {
    type: "player" as const,
    externalId: "1966",
    displayName: "LeBron James",
    sport: "Basketball" as const,
  },
  {
    type: "player" as const,
    externalId: "3975",
    displayName: "Stephen Curry",
    sport: "Basketball" as const,
  },
];

export default function PlayerSearchFixturePage() {
  return (
    <main className="min-h-dvh bg-background p-6">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-semibold">
          Fixture: Player search results
        </h1>

        {/* Search input (static) */}
        <div className="mb-4 flex flex-col gap-2">
          <label className="text-sm font-medium">Search</label>
          <input
            type="search"
            readOnly
            value="lebron"
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-background px-4 text-base outline-none dark:border-zinc-700"
          />
        </div>

        {/* Results list — mirrors the real FavoritesSearch row markup. */}
        <ul
          className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800"
          aria-label="Search results"
          data-testid="search-results"
        >
          {PLAYER_RESULTS.map((r) => (
            <li
              key={r.externalId}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  aria-hidden="true"
                  className="h-7 w-7 shrink-0 rounded-sm bg-zinc-100 dark:bg-zinc-800"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-base font-medium">
                    {r.displayName}
                  </span>
                  <span className="text-xs text-zinc-500">
                    Player · {r.sport}
                  </span>
                </div>
              </div>
              <button className="shrink-0 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
                Add
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-zinc-400">
          Fixture page — Spec 09 Task 3.0 · Not linked in production navigation
        </p>
      </div>
    </main>
  );
}
