"use client";

import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import { groupMatches } from "@/lib/home/tennis-priority";
import { MatchGroupSection } from "./match-group-section";

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
}

export function TournamentCard({ tournament }: Props) {
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

  // Split matches into discipline/gender sections (Spec 08); each is sorted by
  // match priority and rendered as its own collapsible dropdown.
  const sections = groupMatches(matches);

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
      </div>
      {sections.length > 0 && (
        <div className="flex flex-col gap-1 pt-2">
          {sections.map((s) => (
            <MatchGroupSection
              key={s.key}
              label={s.label}
              matches={s.matches}
            />
          ))}
        </div>
      )}
    </article>
  );
}
