/**
 * Server-side cache wrapper around ESPN's per-league scoreboard endpoint
 * used by the homepage aggregator.
 *
 * Spec § Technical Considerations § Tiered cache maps to three TTLs based
 * on which bucket the requested date falls in relative to the user's
 * `today`:
 *
 *   - TODAY (and the request's exact `today`) — 30s. Short enough that
 *     the homepage's 60s client poll sees fresh live data; long enough
 *     to coalesce concurrent renders.
 *   - TOMORROW (and the widened `tomorrow+1`) — 300s (5 min). Schedules
 *     shift rarely intraday.
 *   - YESTERDAY (and the widened `yesterday-1`) — 3600s (1 hour). Past
 *     results are settled.
 *   - Default fallback — 300s.
 *
 * Cache-key prefix is `v3-espn` so the deploy invalidates the prior
 * `v2-utc` (TheSportsDB) keyspace.
 */

import { unstable_cache } from "next/cache";
import { scoreboardForLeague } from "@/lib/espn/client";
import type { DateWindow } from "@/lib/date-window";
import type { EventsLeagueDayFetcher, Fetchers } from "./aggregator";
import type { Match } from "@/lib/sports/types";

export const REVALIDATE_TODAY_SECONDS = 30;
export const REVALIDATE_YESTERDAY_SECONDS = 3600;
export const REVALIDATE_TOMORROW_SECONDS = 300;
export const REVALIDATE_DEFAULT_SECONDS = 300;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(yyyyMmDd: string, delta: number): string {
  const t = Date.parse(`${yyyyMmDd}T00:00:00Z`);
  const d = new Date(t + delta * MS_PER_DAY);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the cache `revalidate` TTL (in seconds) for a given UTC fetch
 * date relative to the user-supplied window. The widened ±1 neighbors
 * inherit the TTL of the bucket they neighbor (yesterday-1 → 1h,
 * tomorrow+1 → 5m).
 *
 * Pure — exported for testing.
 */
export function chooseRevalidate(callDate: string, dates: DateWindow): number {
  if (callDate === dates.today) return REVALIDATE_TODAY_SECONDS;
  if (callDate === dates.yesterday || callDate === addDays(dates.yesterday, -1))
    return REVALIDATE_YESTERDAY_SECONDS;
  if (callDate === dates.tomorrow || callDate === addDays(dates.tomorrow, 1))
    return REVALIDATE_TOMORROW_SECONDS;
  return REVALIDATE_DEFAULT_SECONDS;
}

export const CACHE_KEY_PREFIX = "v3-espn";

/**
 * Wraps `scoreboardForLeague` in `unstable_cache` with a per-(leagueKey,
 * date) key and a TTL chosen by `chooseRevalidate`. The cache key bumps
 * to `v3-espn` so the deploy invalidates the prior `v2-utc` keyspace.
 */
function cachedScoreboard(
  leagueKey: string,
  date: string,
  dates: DateWindow,
): Promise<Match[]> {
  const wrapped = unstable_cache(
    async (lk: string, d: string): Promise<Match[]> =>
      scoreboardForLeague(lk, d),
    [CACHE_KEY_PREFIX, "scoreboard", leagueKey, date],
    { revalidate: chooseRevalidate(date, dates) },
  );
  return wrapped(leagueKey, date);
}

/**
 * Returns the cache-wrapped fetcher the aggregator expects. The `dates`
 * argument lets the cache choose the right TTL per call without the
 * aggregator having to know about bucket semantics.
 */
export function makeCachedFetchers(dates: DateWindow): Fetchers {
  return {
    eventsLeagueDay: (leagueKey, date) =>
      cachedScoreboard(leagueKey, date, dates),
  };
}

/**
 * Backwards-compatible alias for callers that only want the day fetcher.
 * Kept so existing tests/mocks don't break; new code should use
 * `makeCachedFetchers`.
 */
export function makeCachedEventsLeagueDayFetcher(
  dates: DateWindow,
): EventsLeagueDayFetcher {
  return makeCachedFetchers(dates).eventsLeagueDay;
}
