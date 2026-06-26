"use client";

import { useState } from "react";
import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import { LATE_KICKOFF_SENTINEL } from "@/lib/home/sort-helpers";
import { TennisMatchCard } from "./tennis-match-card";

function formatDateRange(startDate: string, endDate: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const start = fmt.format(new Date(`${startDate}T12:00:00Z`));
  const end = fmt.format(new Date(`${endDate}T12:00:00Z`));
  return `${start} – ${end}`;
}

interface Props {
  tournament: ActiveTournament;
  /** Initial expanded state. Defaults to collapsed; fixtures may open it. */
  defaultOpen?: boolean;
}

export function TournamentCard({ tournament, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const {
    displayName,
    startDate,
    endDate,
    currentRound,
    liveCount,
    upcomingCount,
    doneCount,
    matches,
  } = tournament;

  const sortedMatches = [...matches].sort((a, b) => {
    const ak = a.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
    const bk = b.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
    return ak.localeCompare(bk);
  });

  return (
    <article
      data-testid="tournament-card"
      className="rounded-md border border-zinc-200 bg-background p-2.5 shadow-sm dark:border-zinc-800"
    >
      <div className="flex min-h-11 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold leading-tight">
            {displayName}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDateRange(startDate, endDate)}
          </span>
        </div>
        {currentRound && (
          <span
            data-testid="tournament-round"
            className="hidden shrink-0 text-xs text-zinc-600 dark:text-zinc-400 sm:block"
          >
            {currentRound}
          </span>
        )}
        <span
          data-testid="tournament-counts"
          className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
        >
          {liveCount} live · {upcomingCount} upcoming · {doneCount} done
        </span>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse matches" : "Expand matches"}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className={[
              "h-3 w-3 transition-transform",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4.5L6 8L10 4.5" />
          </svg>
        </button>
      </div>
      {isOpen && (
        <div className="grid grid-cols-1 gap-2 pt-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
          {sortedMatches.map((m) => (
            <TennisMatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </article>
  );
}
