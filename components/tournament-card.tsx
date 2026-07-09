"use client";

import { useState } from "react";
import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import { groupMatches } from "@/lib/home/tennis-priority";
import { primaryFamily, secondaryFamily } from "@/lib/home/tennis-card-stages";
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

function Arrow({ direction }: { direction: "down" | "up" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={[
        "h-3 w-3 shrink-0 transition-transform",
        direction === "up" ? "rotate-180" : "",
      ].join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4.5L6 8L10 4.5" />
    </svg>
  );
}

interface Props {
  tournament: ActiveTournament;
}

/**
 * Tournament card with staged disclosure (Spec 10): collapsed by default; the
 * header toggle reveals the primary family (singles, or doubles when a
 * tournament has no singles) and collapses it again. When doubles exists
 * alongside singles, it is revealed independently via a "see doubles
 * matches" control below the singles sections, with its own collapse
 * control — no second header activation needed.
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

  const [expanded, setExpanded] = useState(false);
  const [doublesOpen, setDoublesOpen] = useState(false);

  // Split matches into discipline/gender sections (Spec 08); each is sorted by
  // match priority. Spec 10 reveals them in stages (primary, then doubles).
  const groups = groupMatches(matches);
  const primary = primaryFamily(groups);
  const secondary = secondaryFamily(groups);
  const isInteractive = primary.length > 0;

  function toggle() {
    setExpanded((e) => {
      const next = !e;
      if (!next) setDoublesOpen(false);
      return next;
    });
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
      {isInteractive && <Arrow direction={expanded ? "up" : "down"} />}
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
          aria-expanded={expanded}
          className="flex min-h-11 w-full items-center gap-2 rounded-sm text-left"
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex min-h-11 items-center gap-2">{headerContent}</div>
      )}
      {expanded && primary.length > 0 && (
        <div className="flex flex-col gap-1 pt-2">
          {primary.map((s) => (
            <MatchGroupSection
              key={s.key}
              label={s.label}
              matches={s.matches}
            />
          ))}
        </div>
      )}
      {expanded && secondary.length > 0 && !doublesOpen && (
        <button
          type="button"
          onClick={() => setDoublesOpen(true)}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-sm text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          See doubles matches
          <Arrow direction="down" />
        </button>
      )}
      {expanded && secondary.length > 0 && doublesOpen && (
        <>
          <div className="flex flex-col gap-1 pt-2">
            {secondary.map((s) => (
              <MatchGroupSection
                key={s.key}
                label={s.label}
                matches={s.matches}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDoublesOpen(false)}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-sm text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Collapse doubles matches
            <Arrow direction="up" />
          </button>
        </>
      )}
    </article>
  );
}
