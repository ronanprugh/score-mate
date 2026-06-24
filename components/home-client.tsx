"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeDateWindow,
  getBrowserTimezone,
  type DateWindow,
} from "@/lib/date-window";
import type { HomeEnvelope } from "@/lib/home/aggregator";
import type { Match } from "@/lib/sportsdb/types";
import { DataSourceErrorBanner } from "./data-source-error-banner";
import { MatchCard } from "./match-card";
import { NoMatchesEmptyState } from "./no-matches-empty-state";

interface Props {
  /** True when the signed-in user has ≥1 favorite. Drives the empty-state copy. */
  hasFavorites: boolean;
}

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; envelope: HomeEnvelope; window: DateWindow };

type DayKey = "yesterday" | "today" | "tomorrow";

const DAY_KEYS: readonly DayKey[] = ["yesterday", "today", "tomorrow"];
const DAY_LABELS: Record<DayKey, string> = {
  yesterday: "Yesterday",
  today: "Today",
  tomorrow: "Tomorrow",
};

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
 * polling. Renders a tabbed view (Yesterday / Today / Tomorrow); only the
 * active day's matches are rendered into the DOM at a time. Polling pauses
 * when the tab is hidden and resumes when it returns to visible. Any
 * in-flight fetch is aborted on unmount and on visibility-hidden.
 */
export function HomeClient({ hasFavorites }: Props) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [activeDay, setActiveDay] = useState<DayKey>("today");
  const abortRef = useRef<AbortController | null>(null);
  const fetchTriggerRef = useRef<(() => void) | null>(null);

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
    fetchTriggerRef.current = runFetch;

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
      fetchTriggerRef.current = null;
    };
  }, []);

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
  const counts: Record<DayKey, number> = {
    yesterday: envelope.yesterday.length,
    today: envelope.today.length,
    tomorrow: envelope.tomorrow.length,
  };
  const activeMatches: Match[] = envelope[activeDay];
  const activeDate = window[activeDay];

  return (
    <div className="flex flex-col gap-3">
      {!envelope.source.ok && (
        <DataSourceErrorBanner errorCount={envelope.source.errors.length} />
      )}
      {showEmpty ? (
        <NoMatchesEmptyState />
      ) : !hasFavorites && totalMatches === 0 ? (
        <NoFavoritesPrompt />
      ) : (
        <>
          <DayTabs
            active={activeDay}
            onChange={setActiveDay}
            counts={counts}
            window={window}
          />
          <DayPanel
            day={activeDay}
            dateLabel={activeDate}
            matches={activeMatches}
          />
        </>
      )}
    </div>
  );
}

interface DayTabsProps {
  active: DayKey;
  onChange: (day: DayKey) => void;
  counts: Record<DayKey, number>;
  window: DateWindow;
}

function DayTabs({ active, onChange, counts, window }: DayTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Match day"
      data-testid="day-tabs"
      className="sticky top-0 z-10 -mx-2 flex gap-1 bg-background/95 px-2 py-1 backdrop-blur"
    >
      {DAY_KEYS.map((key) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`day-tab-${key}`}
            aria-controls={`day-panel-${key}`}
            aria-selected={isActive}
            data-testid={`day-tab-${key}`}
            onClick={() => onChange(key)}
            className={[
              "inline-flex min-h-11 flex-1 flex-col items-center justify-center rounded-md px-3 text-xs font-medium transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            <span className="text-sm font-semibold leading-tight">
              {DAY_LABELS[key]}
            </span>
            <span className="text-[10px] leading-tight opacity-75">
              {window[key]} · {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface DayPanelProps {
  day: DayKey;
  dateLabel: string;
  matches: Match[];
}

function DayPanel({ day, dateLabel, matches }: DayPanelProps) {
  return (
    <section
      role="tabpanel"
      id={`day-panel-${day}`}
      aria-labelledby={`day-tab-${day}`}
      data-testid={`day-panel-${day}`}
      aria-label={`${DAY_LABELS[day]} — ${dateLabel}`}
      className="flex flex-col gap-2"
    >
      {matches.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No matches for {DAY_LABELS[day].toLowerCase()}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </section>
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
