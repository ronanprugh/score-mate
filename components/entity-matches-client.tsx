"use client";

import { useEffect, useRef, useState } from "react";
import { APP_BASE_PATH } from "@/lib/auth/constants";
import type { Match } from "@/lib/sports/types";
import type { EntityMatchesEnvelope } from "@/lib/teams/types";
import { DataSourceErrorBanner } from "./data-source-error-banner";
import { MatchCard } from "./match-card";
import { TennisMatchCard } from "./tennis-match-card";

/** Renders a match with the same card Home uses for its sport. */
function EntityMatchCard({ match }: { match: Match }) {
  return match.sport === "Tennis" ? (
    <TennisMatchCard match={match} />
  ) : (
    <MatchCard match={match} />
  );
}

interface Props {
  favoriteId: string;
  displayName: string;
}

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; envelope: EntityMatchesEnvelope };

/**
 * Owns the `/api/teams/[favoriteId]/matches` fetch and renders the entity's
 * match history. A single fetch on mount — unlike Home/Teams, this screen
 * does not poll (schedules/results are largely static; see Spec 11 Non-Goal
 * #2).
 */
export function EntityMatchesClient({ favoriteId }: Props) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    // fetch() is not basePath-aware, so the /ScoreMate prefix is explicit.
    const url = `${APP_BASE_PATH}/api/teams/${favoriteId}/matches`;
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Matches fetch failed (${res.status})`);
        const envelope = (await res.json()) as EntityMatchesEnvelope;
        setState({ status: "ready", envelope });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({
          status: "error",
          message: "Couldn't load matches. Please try again.",
        });
      });

    return () => controller.abort();
  }, [favoriteId]);

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

  const { envelope } = state;

  return (
    <div className="flex flex-col gap-3">
      {!envelope.source.ok && (
        <DataSourceErrorBanner errorCount={envelope.source.errors.length} />
      )}
      <MatchHistoryList recent={envelope.recent} upcoming={envelope.upcoming} />
    </div>
  );
}

interface MatchHistoryListProps {
  /** Most-recent-first, as returned by the API. */
  recent: Match[];
  /** Soonest-first, as returned by the API. */
  upcoming: Match[];
}

/**
 * Renders recent + upcoming as one continuous past→future list with a
 * divider marking the completed/upcoming boundary, opening scrolled to the
 * most recent completed match. Degrades to per-section or combined empty
 * copy when one or both sides have no matches.
 */
function MatchHistoryList({ recent, upcoming }: MatchHistoryListProps) {
  // API returns `recent` most-recent-first; the chronological list reads
  // oldest→newest, so the most recent completed match sits directly above
  // the divider (and is the item we scroll into view on mount).
  const ascendingRecent = [...recent].slice().reverse();
  const mostRecentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll after the (already lazy-loaded) card images have had a layout
    // pass, so the target doesn't shift once badges/logos finish loading.
    const id = requestAnimationFrame(() => {
      mostRecentRef.current?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [recent, upcoming]);

  const bothEmpty = recent.length === 0 && upcoming.length === 0;

  if (bothEmpty) {
    return (
      <p
        className="py-6 text-center text-sm text-zinc-500"
        data-testid="entity-matches-unavailable"
      >
        Match data unavailable
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="entity-matches-list">
      {ascendingRecent.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">
          No recent matches
        </p>
      ) : (
        ascendingRecent.map((m, i) => {
          const isMostRecent = i === ascendingRecent.length - 1;
          return (
            <div key={m.id} ref={isMostRecent ? mostRecentRef : undefined}>
              <EntityMatchCard match={m} />
            </div>
          );
        })
      )}

      <div
        role="separator"
        aria-label="Today"
        data-testid="entity-matches-divider"
        className="flex items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
      >
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        Today
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {upcoming.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">
          No upcoming matches
        </p>
      ) : (
        upcoming.map((m) => <EntityMatchCard key={m.id} match={m} />)
      )}
    </div>
  );
}
