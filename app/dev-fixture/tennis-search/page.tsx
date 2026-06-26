/**
 * Dev-only fixture page for Spec 05 T4.5 screenshots.
 * Renders the favorites search component pre-populated with Tennis results.
 * NOT linked from any production route or navigation.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fixture: Tennis search",
};

const WIMBLEDON_RESULT = {
  type: "event" as const,
  externalId: "tennis/slam/wimbledon",
  displayName: "Wimbledon",
  sport: "Tennis" as const,
};

const AUSTRALIAN_OPEN_RESULT = {
  type: "event" as const,
  externalId: "tennis/slam/australian-open",
  displayName: "Australian Open",
  sport: "Tennis" as const,
};

const ROLAND_GARROS_RESULT = {
  type: "event" as const,
  externalId: "tennis/slam/roland-garros",
  displayName: "Roland Garros",
  sport: "Tennis" as const,
};

export default function TennisSearchFixturePage() {
  return (
    <main className="min-h-dvh bg-background p-6">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-semibold">
          Fixture: Tennis search results
        </h1>

        {/* Search input (static) */}
        <div className="mb-4 flex flex-col gap-2">
          <label className="text-sm font-medium">Search</label>
          <input
            type="search"
            readOnly
            value="wimbledon"
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-background px-4 text-base outline-none dark:border-zinc-700"
          />
        </div>

        {/* Results list */}
        <ul
          className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800"
          aria-label="Search results"
          data-testid="search-results"
        >
          {[WIMBLEDON_RESULT, AUSTRALIAN_OPEN_RESULT, ROLAND_GARROS_RESULT].map(
            (r) => (
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
                      Event · {r.sport}
                    </span>
                  </div>
                </div>
                {/* Add button — "Added" state for Wimbledon */}
                <button
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
                    r.externalId === "tennis/slam/wimbledon"
                      ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  }`}
                >
                  {r.externalId === "tennis/slam/wimbledon" ? "Added" : "Add"}
                </button>
              </li>
            ),
          )}
        </ul>

        <p className="mt-6 text-xs text-zinc-400">
          Fixture page — Spec 05 T4.5 · Not linked in production navigation
        </p>
      </div>
    </main>
  );
}
