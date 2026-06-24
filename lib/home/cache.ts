/**
 * Server-side cache wrappers around TheSportsDB's `eventsDay`.
 *
 * Spec § Technical Considerations § Server-side caching maps to two
 * distinct TTLs in practice:
 *
 *   - TODAY  — 30s. Short enough that the homepage's 60s client poll
 *              (Task 6.0) sees fresh live data; long enough to coalesce
 *              concurrent renders.
 *   - YESTERDAY / TOMORROW — 600s (10 min). Yesterday's results are
 *              settled; tomorrow's schedule rarely changes intraday.
 *
 * The split is implemented as two separately-cached function instances
 * (each `unstable_cache(...)` call defines its own cache key namespace).
 * The aggregator picks the right wrapper based on whether the date string
 * equals the user's "today".
 */

import { unstable_cache } from "next/cache";
import { eventsDay } from "@/lib/sportsdb/client";
import type { DateWindow } from "@/lib/date-window";
import type { EventsDayFetcher } from "./aggregator";
import type { Match, Sport } from "@/lib/sportsdb/types";

const REVALIDATE_TODAY_SECONDS = 30;
const REVALIDATE_ADJACENT_SECONDS = 600;

const eventsDayCachedShort = unstable_cache(
  async (date: string, sport: Sport): Promise<Match[]> =>
    eventsDay(date, sport),
  ["sportsdb", "eventsDay", "short"],
  { revalidate: REVALIDATE_TODAY_SECONDS },
);

const eventsDayCachedLong = unstable_cache(
  async (date: string, sport: Sport): Promise<Match[]> =>
    eventsDay(date, sport),
  ["sportsdb", "eventsDay", "long"],
  { revalidate: REVALIDATE_ADJACENT_SECONDS },
);

/**
 * Returns the cache-wrapped `eventsDay` fetcher to use for a given window.
 * Routes the "today" date through the 30s cache and y/tomorrow through
 * the 10min cache.
 */
export function makeCachedEventsDayFetcher(
  dates: DateWindow,
): EventsDayFetcher {
  return (date, sport) => {
    if (date === dates.today) return eventsDayCachedShort(date, sport);
    return eventsDayCachedLong(date, sport);
  };
}
