"use client";

import { useState } from "react";
import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import { groupMatches } from "@/lib/home/tennis-priority";
import {
  nextStage,
  sectionsForStage,
  stageHint,
  totalStages,
} from "@/lib/home/tennis-card-stages";
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

/**
 * Tournament card with staged disclosure (Spec 10): collapsed by default, the
 * first activation reveals singles sections, and a second reveals doubles too;
 * a further activation wraps back to collapsed. When only one discipline
 * family is present the card has a single expanded stage; when none are
 * present the header renders as a plain, non-interactive block.
 */
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

  const [stage, setStage] = useState(0);

  // Split matches into discipline/gender sections (Spec 08); each is sorted by
  // match priority. Spec 10 reveals them in stages (singles, then doubles).
  const groups = groupMatches(matches);
  const stages = totalStages(groups);
  const visibleSections = sectionsForStage(groups, stage);
  const hint = stageHint(groups, stage);
  const isInteractive = stages > 1;

  function toggle() {
    setStage((s) => nextStage(groups, s));
  }

  const headerContent = (
    <>
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
      {isInteractive && (
        <>
          {hint && (
            <span
              data-testid="tournament-stage-hint"
              className="hidden shrink-0 text-xs text-zinc-500 dark:text-zinc-400 sm:block"
            >
              {hint}
            </span>
          )}
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className={[
              "h-3 w-3 shrink-0 transition-transform",
              stage > 0 ? "rotate-180" : "",
            ].join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4.5L6 8L10 4.5" />
          </svg>
        </>
      )}
    </>
  );

  return (
    <article
      data-testid="tournament-card"
      className="rounded-md border border-zinc-200 bg-background p-2.5 shadow-sm dark:border-zinc-800"
    >
      {isInteractive ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={stage > 0}
          className="flex min-h-11 w-full items-center gap-2 rounded-sm text-left"
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex min-h-11 items-center gap-2">{headerContent}</div>
      )}
      {visibleSections.length > 0 && (
        <div className="flex flex-col gap-1 pt-2">
          {visibleSections.map((s) => (
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
