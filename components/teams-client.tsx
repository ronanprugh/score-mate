"use client";

import { useEffect, useRef, useState } from "react";
import { APP_BASE_PATH } from "@/lib/auth/constants";
import type { TeamsEnvelope } from "@/lib/teams/types";
import { DataSourceErrorBanner } from "./data-source-error-banner";
import { EntityCard } from "./entity-card";

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; envelope: TeamsEnvelope };

/** Poll interval — team schedules change slowly, so a gentle 60s refresh. */
const POLL_MS = 60_000;

/**
 * Owns the `/api/teams` fetch and a gentle background refresh. Mirrors
 * `HomeClient`: fetches on mount, refetches on tab re-focus, polls every 60s
 * while visible, and aborts any in-flight request on unmount / tab-hide.
 * Renders one `EntityCard` per followed team/player.
 */
export function TeamsClient() {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const runFetch = () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      // fetch() is not basePath-aware, so the /ScoreMate prefix is explicit.
      const url = `${APP_BASE_PATH}/api/teams`;
      fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Teams fetch failed (${res.status})`);
          const envelope = (await res.json()) as TeamsEnvelope;
          setState({ status: "ready", envelope });
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setState((prev) =>
            prev.status === "ready"
              ? prev
              : {
                  status: "error",
                  message: "Couldn't load teams. Please try again.",
                },
          );
        });
    };

    runFetch();

    const onVisibility = () => {
      if (document.visibilityState === "visible") runFetch();
      else abortRef.current?.abort();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const id = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      runFetch();
    }, POLL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <p className="text-sm text-zinc-500" aria-live="polite">
        Loading teams…
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {envelope.entities.map((entity) => (
          <EntityCard key={entity.favoriteId} entity={entity} />
        ))}
      </div>
    </div>
  );
}
