/**
 * Cached per-league schedule lookups shared by both Teams routes.
 *
 * Kept separate from `lib/teams/schedule.ts` so that module stays free of
 * Next.js internals and remains unit-testable without mocking `next/cache`.
 */

import { unstable_cache } from "next/cache";
import {
  currentEspnSeasonYear,
  teamScheduleForLeague,
} from "@/lib/espn/client";
import type { Match } from "@/lib/sports/types";

/**
 * In-process cache TTL. Matches the value Spec 12 selected for this path —
 * completed results never change and kickoff times rarely do.
 */
export const SCHEDULE_CACHE_TTL_SECONDS = 300;

/**
 * Cache key for one team's schedule in one competition.
 *
 * The season is part of the key on purpose. `teamScheduleForLeague` may answer
 * with *previous*-season data when the current season has no fixtures
 * published yet; keying only on (league, team) would let that fallback result
 * outlive the rollover and turn a fixed bug into a stale screen — a harder
 * failure to diagnose than the empty one it replaced (Spec 13, Unit 1 FR6).
 */
export function scheduleCacheKey(
  leagueKey: string,
  teamId: string,
  season: number,
): string[] {
  return ["teams-team-schedule", leagueKey, teamId, String(season)];
}

/**
 * `teamScheduleForLeague` behind `unstable_cache`, keyed per competition so
 * each league in a fan-out caches and expires independently.
 *
 * Note: Next.js 16 documents `unstable_cache` as superseded by the `use cache`
 * directive. Spec 12 evaluated that migration and chose to stay here for now;
 * Spec 13 defers to that decision (Non-Goal #4).
 */
export function cachedTeamScheduleForLeague(
  leagueKey: string,
  teamId: string,
): Promise<Match[]> {
  const season = currentEspnSeasonYear();
  return unstable_cache(
    () => teamScheduleForLeague(leagueKey, teamId),
    scheduleCacheKey(leagueKey, teamId, season),
    { revalidate: SCHEDULE_CACHE_TTL_SECONDS },
  )();
}
