/**
 * Server-side cache wrappers around TheSportsDB endpoints used by the
 * homepage aggregator.
 *
 * Spec § Technical Considerations § Server-side caching maps to two TTLs
 * for the day-level fetch:
 *
 *   - TODAY  — 30s. Short enough that the homepage's 60s client poll
 *              (Task 6.0) sees fresh live data; long enough to coalesce
 *              concurrent renders.
 *   - YESTERDAY / TOMORROW — 600s (10 min). Yesterday's results are
 *              settled; tomorrow's schedule rarely changes intraday.
 *
 * The per-team and per-league fetches use a single 5-minute TTL — they're
 * not the live-score path (the per-sport day fetch is), so they don't
 * need to be aggressively short.
 */

import { unstable_cache } from "next/cache";
import {
  eventsDay,
  eventsLast,
  eventsNext,
  eventsNextLeague,
  eventsPastLeague,
} from "@/lib/sportsdb/client";
import type { DateWindow } from "@/lib/date-window";
import type { Fetchers } from "./aggregator";
import type { Match, Sport } from "@/lib/sportsdb/types";

const REVALIDATE_TODAY_SECONDS = 30;
const REVALIDATE_ADJACENT_SECONDS = 600;
const REVALIDATE_TEAM_LEAGUE_SECONDS = 300;

const eventsDayCachedShort = unstable_cache(
  async (date: string, sport: Sport): Promise<Match[]> =>
    eventsDay(date, sport),
  ["sportsdb", "eventsDay", "short", "v2-utc"],
  { revalidate: REVALIDATE_TODAY_SECONDS },
);

const eventsDayCachedLong = unstable_cache(
  async (date: string, sport: Sport): Promise<Match[]> =>
    eventsDay(date, sport),
  ["sportsdb", "eventsDay", "long", "v2-utc"],
  { revalidate: REVALIDATE_ADJACENT_SECONDS },
);

const eventsNextTeamCached = unstable_cache(
  async (teamId: string): Promise<Match[]> => eventsNext(teamId),
  ["sportsdb", "eventsNext", "v2-utc"],
  { revalidate: REVALIDATE_TEAM_LEAGUE_SECONDS },
);

const eventsLastTeamCached = unstable_cache(
  async (teamId: string): Promise<Match[]> => eventsLast(teamId),
  ["sportsdb", "eventsLast", "v2-utc"],
  { revalidate: REVALIDATE_TEAM_LEAGUE_SECONDS },
);

const eventsNextLeagueCached = unstable_cache(
  async (leagueId: string): Promise<Match[]> => eventsNextLeague(leagueId),
  ["sportsdb", "eventsNextLeague", "v2-utc"],
  { revalidate: REVALIDATE_TEAM_LEAGUE_SECONDS },
);

const eventsPastLeagueCached = unstable_cache(
  async (leagueId: string): Promise<Match[]> => eventsPastLeague(leagueId),
  ["sportsdb", "eventsPastLeague", "v2-utc"],
  { revalidate: REVALIDATE_TEAM_LEAGUE_SECONDS },
);

/**
 * Returns the cache-wrapped fetchers bundle the aggregator expects.
 *
 * - eventsDay routes "today" through the 30 s cache, y/tomorrow through
 *   the 10 min cache.
 * - eventsTeam internally fans out to `eventsNext` + `eventsLast` in
 *   parallel and unions the results so a single upstream slowness can't
 *   block the other.
 * - eventsLeague internally fans out to `eventsNextLeague` +
 *   `eventsPastLeague` the same way.
 */
export function makeCachedFetchers(dates: DateWindow): Fetchers {
  return {
    eventsDay: (date, sport) => {
      if (date === dates.today) return eventsDayCachedShort(date, sport);
      return eventsDayCachedLong(date, sport);
    },
    eventsTeam: async (teamId) => {
      const settled = await Promise.allSettled([
        eventsNextTeamCached(teamId),
        eventsLastTeamCached(teamId),
      ]);
      const out: Match[] = [];
      for (const s of settled) {
        if (s.status === "fulfilled") out.push(...s.value);
      }
      return out;
    },
    eventsLeague: async (leagueId) => {
      const settled = await Promise.allSettled([
        eventsNextLeagueCached(leagueId),
        eventsPastLeagueCached(leagueId),
      ]);
      const out: Match[] = [];
      for (const s of settled) {
        if (s.status === "fulfilled") out.push(...s.value);
      }
      return out;
    },
  };
}

/**
 * Backwards-compatible alias for callers that only want the day fetcher.
 * Kept so existing tests/mocks don't break; new code should use
 * `makeCachedFetchers`.
 */
export function makeCachedEventsDayFetcher(
  dates: DateWindow,
): Fetchers["eventsDay"] {
  return makeCachedFetchers(dates).eventsDay;
}
