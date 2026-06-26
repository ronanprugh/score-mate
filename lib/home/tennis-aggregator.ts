/**
 * Aggregates active marquee tennis tournaments for the homepage.
 *
 * Tennis differs from league-sport favorites in that the homepage shows all
 * in-session marquee tournaments regardless of the user's favorites list.
 * This module fans out one `TennisScoreboardFetcher` call per tournament
 * in parallel and collects only those that return ≥1 match for `today`.
 */

import { MARQUEE_TENNIS_TOURNAMENTS } from "@/lib/espn/tennis";
import type { TennisTour, TennisScoreboardResult } from "@/lib/espn/tennis";
import type { Match } from "@/lib/sports/types";

/**
 * Fetches one marquee tournament's matches for a single local date, plus the
 * tournament's overall draw span.
 */
export type TennisScoreboardFetcher = (
  tournamentId: string,
  date: string,
) => Promise<TennisScoreboardResult>;

/** A marquee tournament that is in-session today (has ≥1 ESPN match). */
export interface ActiveTournament {
  id: string;
  displayName: string;
  tour: TennisTour;
  /** Earliest `dateUtc` across all matches returned for today. */
  startDate: string;
  /** Latest `dateUtc` across all matches returned for today. */
  endDate: string;
  /** `round` field of the first match; `undefined` when not present. */
  currentRound: string | undefined;
  liveCount: number;
  upcomingCount: number;
  doneCount: number;
  matches: Match[];
}

/**
 * Returns every marquee tournament that is in-session on `today`.
 * Tournaments whose fetcher call rejects or returns `[]` are silently
 * dropped — the caller decides how to handle partial failures (the
 * cache wrapper logs via `source.errors`).
 */
export async function getActiveTennisTournaments(
  today: string,
  fetcher: TennisScoreboardFetcher,
): Promise<ActiveTournament[]> {
  const settled = await Promise.allSettled(
    MARQUEE_TENNIS_TOURNAMENTS.map(async (t) => ({
      tournament: t,
      result: await fetcher(t.id, today),
    })),
  );

  const active: ActiveTournament[] = [];
  for (const r of settled) {
    if (r.status === "rejected") continue;
    const { tournament, result } = r.value;
    const { matches } = result;
    if (matches.length === 0) continue;

    // Date range = the tournament's overall draw span (not this single day);
    // fall back to the day's matches if the fetcher didn't surface a span.
    const dayDates = matches.map((m) => m.dateUtc);
    const startDate =
      result.eventStartDate ?? dayDates.reduce((a, b) => (a < b ? a : b));
    const endDate =
      result.eventEndDate ?? dayDates.reduce((a, b) => (a > b ? a : b));

    active.push({
      id: tournament.id,
      displayName: tournament.displayName,
      tour: tournament.tour,
      startDate,
      endDate,
      // Prefer the real round (e.g. "Quarterfinals"); fall back to the
      // draw/grouping name only when ESPN omits the round.
      currentRound: matches[0]?.tennis?.round ?? matches[0]?.round,
      liveCount: matches.filter((m) => m.status === "live").length,
      upcomingCount: matches.filter((m) => m.status === "upcoming").length,
      doneCount: matches.filter((m) => m.status === "final").length,
      matches,
    });
  }
  return active;
}
