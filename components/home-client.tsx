"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  computeDateWindow,
  getBrowserTimezone,
  type DateWindow,
} from "@/lib/date-window";
import { APP_BASE_PATH } from "@/lib/auth/constants";
import type { HomeEnvelope } from "@/lib/home/aggregator";
import { LATE_KICKOFF_SENTINEL } from "@/lib/home/sort-helpers";
import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import type { Match } from "@/lib/sports/types";
import { DataSourceErrorBanner } from "./data-source-error-banner";
import { MatchCard } from "./match-card";
import { NoMatchesEmptyState } from "./no-matches-empty-state";
import { TournamentCard } from "./tournament-card";

interface Props {
  /** True when the signed-in user has ≥1 favorite. Drives the empty-state copy. */
  hasFavorites: boolean;
  /**
   * True when the user has ≥1 favorite that feeds the home feed (i.e. not a
   * team/player favorite). When false but `hasFavorites` is true, the user
   * only follows teams/players — those live on the Teams tab, so we show a
   * pointer there instead of the generic "no matches" empty state.
   */
  hasLeagueFavorites: boolean;
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

interface MatchGroup {
  leagueName: string;
  matches: Match[];
  /** Earliest kickoff in the group; used to order groups within a day. */
  earliestKickoff: string;
}

function groupMatchesByLeague(matches: readonly Match[]): MatchGroup[] {
  const byLeague = new Map<string, Match[]>();
  for (const m of matches) {
    const arr = byLeague.get(m.leagueName);
    if (arr) arr.push(m);
    else byLeague.set(m.leagueName, [m]);
  }
  const out: MatchGroup[] = [];
  for (const [leagueName, group] of byLeague) {
    const sorted = [...group].sort((a, b) => {
      const ak = a.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
      const bk = b.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
      return ak.localeCompare(bk);
    });
    out.push({
      leagueName,
      matches: sorted,
      earliestKickoff: sorted[0]?.kickoffUtc ?? LATE_KICKOFF_SENTINEL,
    });
  }
  out.sort((a, b) => a.earliestKickoff.localeCompare(b.earliestKickoff));
  return out;
}

/**
 * Owns the date-window computation, the /api/home fetch, and live-gated
 * polling. Renders a tabbed view (Yesterday / Today / Tomorrow); only the
 * active day's matches are rendered into the DOM at a time. Polling pauses
 * when the tab is hidden and resumes when it returns to visible. Any
 * in-flight fetch is aborted on unmount and on visibility-hidden.
 */
export function HomeClient({ hasFavorites, hasLeagueFavorites }: Props) {
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
      // fetch() is not basePath-aware, so the /ScoreMate prefix is explicit.
      const url = `${APP_BASE_PATH}/api/home?dates=${window.yesterday},${window.today},${window.tomorrow}&tz=${encodeURIComponent(tz)}`;
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
  const tennis = envelope.activeTennisTournaments;
  const counts: Record<DayKey, number> = {
    yesterday: envelope.yesterday.length + tennis.yesterday.length,
    today: envelope.today.length + tennis.today.length,
    tomorrow: envelope.tomorrow.length + tennis.tomorrow.length,
  };
  const totalItems = counts.yesterday + counts.today + counts.tomorrow;
  // A user who only follows teams/players has favorites but nothing feeding
  // the home feed — point them at the Teams tab rather than the generic
  // "no matches" state.
  const showTeamsOnly = totalItems === 0 && hasFavorites && !hasLeagueFavorites;
  const showEmpty = totalItems === 0 && hasFavorites && hasLeagueFavorites;
  const activeMatches: Match[] = envelope[activeDay];
  const activeDate = window[activeDay];

  return (
    <div className="flex flex-col gap-3">
      {!envelope.source.ok && (
        <DataSourceErrorBanner errorCount={envelope.source.errors.length} />
      )}
      {showTeamsOnly ? (
        <TeamsOnlyPrompt />
      ) : showEmpty ? (
        <NoMatchesEmptyState />
      ) : !hasFavorites && totalItems === 0 ? (
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
            activeTennisTournaments={tennis[activeDay]}
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
  activeTennisTournaments?: ActiveTournament[];
}

/**
 * A collapsible section with an uppercase header + count, matching the league
 * grouping treatment. Used for both the Tennis section and each league group
 * so all three day tabs render consistently.
 */
function CollapsibleSection({
  testId,
  title,
  count,
  children,
}: {
  testId: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details
      data-testid={testId}
      open
      className="group flex flex-col gap-1.5 [&[open]>summary>svg]:rotate-90"
    >
      <summary
        className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-sm py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-100"
        title={title}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="h-2.5 w-2.5 shrink-0 transition-transform"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 2.5L8 6L4 9.5" />
        </svg>
        <span className="truncate">{title}</span>
        <span
          aria-hidden="true"
          className="shrink-0 font-normal normal-case tracking-normal text-zinc-400 dark:text-zinc-500"
        >
          ({count})
        </span>
      </summary>
      {children}
    </details>
  );
}

function DayPanel({
  day,
  dateLabel,
  matches,
  activeTennisTournaments = [],
}: DayPanelProps) {
  // All three tabs render the same way: a "Tennis" section (when present),
  // then league-grouped team matches — each with its own header.
  const groups = groupMatchesByLeague(matches);
  const hasTennis = activeTennisTournaments.length > 0;
  const isEmpty = matches.length === 0 && !hasTennis;
  return (
    <section
      role="tabpanel"
      id={`day-panel-${day}`}
      aria-labelledby={`day-tab-${day}`}
      data-testid={`day-panel-${day}`}
      aria-label={`${DAY_LABELS[day]} — ${dateLabel}`}
      className="flex flex-col gap-4"
    >
      {hasTennis && (
        <CollapsibleSection
          testId="tennis-group"
          title="Tennis"
          count={activeTennisTournaments.length}
        >
          {/* Full-width tournament cards so their expandable match list has room. */}
          <div className="flex flex-col gap-2 pt-1">
            {activeTennisTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </CollapsibleSection>
      )}
      {isEmpty ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No matches for {DAY_LABELS[day].toLowerCase()}.
        </p>
      ) : (
        groups.map((g) => (
          <CollapsibleSection
            key={g.leagueName}
            testId={`league-group-${g.leagueName}`}
            title={g.leagueName}
            count={g.matches.length}
          >
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2 lg:grid-cols-3">
              {g.matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </CollapsibleSection>
        ))
      )}
    </section>
  );
}

function TeamsOnlyPrompt() {
  return (
    <section
      role="status"
      data-testid="teams-only-prompt"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-zinc-200 px-6 py-10 text-center dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">Your team matches moved</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your team matches live in the Teams tab now. Favorite a league, sport,
        or tournament to build your home feed.
      </p>
      <a
        href="/teams"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
      >
        Go to Teams
      </a>
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
