/**
 * Client-safe sort helpers for the mixed-feed homepage.
 *
 * Extracted from aggregator.ts so client components can import them without
 * pulling the server-only DB chain (lib/favorites/queries → db/index.ts).
 */

import type { ActiveTournament } from "./tennis-aggregator";
import type { Match } from "@/lib/sports/types";

export const LATE_KICKOFF_SENTINEL = "9999-12-31T23:59:59";

export function sortByKickoff(a: Match, b: Match): number {
  const ak = a.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
  const bk = b.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
  return ak.localeCompare(bk);
}

/**
 * Returns the sort key for a tournament card in the mixed today feed.
 * Uses the minimum `kickoffUtc` across live or upcoming matches.
 * Falls back to `LATE_KICKOFF_SENTINEL` when no live/upcoming matches
 * exist, placing the tournament below all match cards.
 */
export function sortKeyForTournamentCard(t: ActiveTournament): string {
  const liveOrUpcoming = t.matches.filter(
    (m) => m.status === "live" || m.status === "upcoming",
  );
  if (liveOrUpcoming.length === 0) return LATE_KICKOFF_SENTINEL;
  return liveOrUpcoming
    .map((m) => m.kickoffUtc ?? LATE_KICKOFF_SENTINEL)
    .reduce((a, b) => (a < b ? a : b));
}
