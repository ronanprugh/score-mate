"use client";

import { useEffect, useRef, useState } from "react";
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

/** Poll interval while ≥1 live match is on screen. */
const POLL_MS = 60_000;

function envelopeHasLive(env: HomeEnvelope): boolean {
  return (
    env.yesterday.some((m) => m.status === "live") ||
    env.today.some((m) => m.status === "live") ||
    env.tomorrow.some((m) => m.status === "live")
  );
}

/**
 * Owns the date-window computation, the /api/home fetch, and live-gated
 * polling. Polling fires every 60s while the current response contains at
 * least one live match. It pauses when the tab is hidden and resumes when
 * the tab returns to visible. Any in-flight fetch is aborted on unmount
 * and on visibility-hidden.
 */
export function HomeClient({ hasFavorites }: Props) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const abortRef = useRef<AbortController | null>(null);
  const fetchTriggerRef = useRef<(() => void) | null>(null);

  // Initial mount: compute the date window, kick off the first fetch, and
  // wire the visibility listener. The polling timer is owned by a separate
  // effect that watches `state` (below).
  useEffect(() => {
    const tz = getBrowserTimezone();
    const window = computeDateWindow(new Date(), tz);

    const runFetch = () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const url = `/api/home?dates=${window.yesterday},${window.today},${window.tomorrow}`;
      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Home fetch failed (${res.status})`);
          const envelope = (await res.json()) as HomeEnvelope;
          setState({ status: "ready", envelope, window });
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setState((prev) =>
            prev.status === "ready"
              ? prev
              : {
                  status: "error",
                  message: "Couldn't load matches. Please try again.",
                },
          );
        });
    };

    runFetch();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        runFetch();
      } else {
        abortRef.current?.abort();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Expose the per-mount fetch trigger via ref so the polling effect can
    // invoke it without recreating the listener on every state change.
    fetchTriggerRef.current = runFetch;

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
      fetchTriggerRef.current = null;
    };
  }, []);

  // Polling: while we have a `ready` response containing at least one live
  // match, refetch every POLL_MS. The interval is rebuilt whenever `state`
  // changes; clearing on cleanup handles the "no live → stop polling" case.
  useEffect(() => {
    if (state.status !== "ready") return;
    if (!envelopeHasLive(state.envelope)) return;
    const id = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      fetchTriggerRef.current?.();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [state]);

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
