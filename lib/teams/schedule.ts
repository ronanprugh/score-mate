import type { Match } from "@/lib/sports/types";

/** Matches per side shown on the entity detail screen (Spec 11). */
export const MATCH_HISTORY_CAP = 10;

/**
 * Splits a schedule into the `MATCH_HISTORY_CAP` most recent completed
 * matches (most-recent first) and the `MATCH_HISTORY_CAP` soonest upcoming
 * matches (soonest first). Mirrors the sort-key approach in
 * `extractEntityMatches` (`app/api/teams/route.ts`), but keeps full `Match`
 * objects instead of reducing to a single last/next `EntityMatch`.
 */
export function splitAndCapSchedule(matches: readonly Match[]): {
  recent: Match[];
  upcoming: Match[];
} {
  const sortKey = (m: Match) => m.kickoffUtc ?? `${m.dateUtc}T00:00:00Z`;

  const recent = matches
    .filter((m) => m.status === "final")
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    .slice(0, MATCH_HISTORY_CAP);
  const upcoming = matches
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .slice(0, MATCH_HISTORY_CAP);

  return { recent, upcoming };
}
