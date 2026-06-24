"use client";

import { useEffect, useState } from "react";
import {
  computeDateWindow,
  getBrowserTimezone,
  type DateWindow,
} from "@/lib/date-window";
import type { HomeEnvelope } from "@/lib/home/aggregator";
import { DataSourceErrorBanner } from "./data-source-error-banner";
import { DaySection } from "./day-section";
import { NoMatchesEmptyState } from "./no-matches-empty-state";

interface Props {
  /** True when the signed-in user has ≥1 favorite. Drives the empty-state copy. */
  hasFavorites: boolean;
}

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; envelope: HomeEnvelope; window: DateWindow };

/**
 * Owns the date-window computation and the /api/home fetch. Polling is
 * added in Task 6.0 — this task only covers the static render path.
 */
export function HomeClient({ hasFavorites }: Props) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    const tz = getBrowserTimezone();
    const window = computeDateWindow(new Date(), tz);
    const controller = new AbortController();
    const url = `/api/home?dates=${window.yesterday},${window.today},${window.tomorrow}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Home fetch failed (${res.status})`);
        }
        const envelope = (await res.json()) as HomeEnvelope;
        setState({ status: "ready", envelope, window });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({
          status: "error",
          message: "Couldn't load matches. Please try again.",
        });
      });

    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return (
      <p className="text-sm text-zinc-500" aria-live="polite">
        Loading matches…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {state.message}
      </p>
    );
  }

  const { envelope, window } = state;
  const totalMatches =
    envelope.yesterday.length +
    envelope.today.length +
    envelope.tomorrow.length;
  const showEmpty = totalMatches === 0 && hasFavorites;

  return (
    <div className="flex flex-col gap-6">
      {!envelope.source.ok && (
        <DataSourceErrorBanner errorCount={envelope.source.errors.length} />
      )}
      {showEmpty ? (
        <NoMatchesEmptyState />
      ) : !hasFavorites && totalMatches === 0 ? (
        <NoFavoritesPrompt />
      ) : (
        <>
          <DaySection
            label="Yesterday"
            dateLabel={window.yesterday}
            matches={envelope.yesterday}
          />
          <DaySection
            label="Today"
            dateLabel={window.today}
            matches={envelope.today}
          />
          <DaySection
            label="Tomorrow"
            dateLabel={window.tomorrow}
            matches={envelope.tomorrow}
          />
        </>
      )}
    </div>
  );
}

function NoFavoritesPrompt() {
  return (
    <section
      role="status"
      data-testid="no-favorites-prompt"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-zinc-200 px-6 py-10 text-center dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">Add a favorite to get started</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Favorite a team, league, sport, or tournament and we&apos;ll surface
        their matches here.
      </p>
      <a
        href="/favorites"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
      >
        Find favorites
      </a>
    </section>
  );
}
