"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FavoriteAddButton, type FavoritePayload } from "./favorite-add-button";
import type { FavoriteType } from "@/lib/sports/types";

interface InitialFavoriteKey {
  type: FavoriteType;
  externalId: string;
}

interface Props {
  /**
   * Set of (type, externalId) pairs the user already has favorited. Used to
   * render the "Added" state on result rows without an extra round-trip.
   */
  initialFavorites: InitialFavoriteKey[];
}

type SearchResult = FavoritePayload;

const TYPE_LABEL: Record<FavoriteType, string> = {
  team: "Team",
  sport: "Sport",
  league: "League",
  event: "Event",
};

const DEBOUNCE_MS = 300;

/**
 * Mobile-first typeahead. Debounces input, calls /api/favorites/search,
 * renders a single flat list with type-labeled rows. Each row has a
 * one-tap Add control that POSTs in the background.
 */
export function FavoritesSearch({ initialFavorites }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const initialFavoriteKeySet = useMemo(
    () => new Set(initialFavorites.map((f) => `${f.type}:${f.externalId}`)),
    [initialFavorites],
  );

  useEffect(() => {
    const trimmed = q.trim();
    // Debounce ALL state changes — even the reset — by scheduling them
    // inside the timeout callback. Avoids react-hooks/set-state-in-effect.
    const handle = window.setTimeout(() => {
      if (trimmed.length < 2) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      // Cancel any in-flight search.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/favorites/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Search failed (${res.status})`);
          }
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results);
          setError(null);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError("Search failed. Try again.");
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="favorites-search" className="text-sm font-medium">
          Search
        </label>
        <input
          id="favorites-search"
          type="search"
          autoComplete="off"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Team, league, sport, or tournament"
          className="min-h-11 w-full rounded-lg border border-zinc-300 bg-background px-4 text-base outline-none focus:border-zinc-500 dark:border-zinc-700"
        />
        {q.trim().length > 0 && q.trim().length < 2 && (
          <p className="text-xs text-zinc-500">
            Keep typing — at least 2 characters.
          </p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-zinc-500" aria-live="polite">
          Searching…
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && q.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-zinc-500">
          No results for &quot;{q.trim()}&quot;.
        </p>
      )}

      {results.length > 0 && (
        <ul
          className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800"
          aria-label="Search results"
          data-testid="search-results"
        >
          {results.map((r) => {
            const isAdded = initialFavoriteKeySet.has(
              `${r.type}:${r.externalId}`,
            );
            return (
              <li
                key={`${r.type}:${r.externalId}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {r.type === "team" && r.badgeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.badgeUrl}
                      alt=""
                      loading="lazy"
                      className="h-7 w-7 shrink-0 rounded-sm object-contain"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-7 w-7 shrink-0 rounded-sm bg-zinc-100 dark:bg-zinc-800"
                    />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-base font-medium">
                      {r.displayName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {TYPE_LABEL[r.type]} · {r.sport}
                    </span>
                  </div>
                </div>
                <FavoriteAddButton payload={r} initialAdded={isAdded} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
