"use client";

import { useState } from "react";
import type { Match } from "@/lib/sports/types";
import { INITIAL_VISIBLE, SHOW_MORE_STEP } from "@/lib/home/tennis-priority";
import { TennisMatchCard } from "./tennis-match-card";

interface Props {
  /** Section label, e.g. "Men's Singles". */
  label: string;
  /** Matches for this section, already priority-ordered by `groupMatches`. */
  matches: Match[];
}

/**
 * One collapsible discipline/gender section inside a tournament card. Collapsed
 * by default; when expanded it shows the top {@link INITIAL_VISIBLE} matches and
 * reveals {@link SHOW_MORE_STEP} more per "Show more". Live matches are always
 * pinned to the top of the section regardless of priority. Collapsing resets the
 * visible count.
 */
export function MatchGroupSection({ label, matches }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Live matches first (each group already in priority order → stable partition),
  // then the rest in priority order.
  const ordered = [
    ...matches.filter((m) => m.status === "live"),
    ...matches.filter((m) => m.status !== "live"),
  ];
  const visible = ordered.slice(0, visibleCount);
  const remaining = matches.length - visible.length;

  function toggle() {
    // Reset the visible window on every toggle (collapsing resets to the initial
    // 5; a freshly-opened section already starts at 5, so this is harmless on
    // open).
    setIsOpen((open) => !open);
    setVisibleCount(INITIAL_VISIBLE);
  }

  return (
    <section data-testid="match-group" data-section-label={label}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center gap-2 rounded-sm px-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="flex-1 text-sm font-medium">{label}</span>
        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {matches.length}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={[
            "h-3 w-3 shrink-0 transition-transform",
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

      {isOpen && (
        <div className="pt-2">
          <div className="grid grid-cols-1 gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
            {visible.map((m) => (
              <TennisMatchCard key={m.id} match={m} />
            ))}
          </div>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + SHOW_MORE_STEP)}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-sm text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Show more ({remaining})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
