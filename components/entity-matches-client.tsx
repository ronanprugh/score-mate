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
 * #2). The chronological layout (divider, focus-on-recent, empty states) is
 * completed in Task 4.0.
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
      <div className="flex flex-col gap-2">
        {envelope.recent.map((m) => (
          <EntityMatchCard key={m.id} match={m} />
        ))}
        {envelope.upcoming.map((m) => (
          <EntityMatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}
