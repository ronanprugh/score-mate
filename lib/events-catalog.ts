/**
 * Hand-curated catalog of tournament/event instances that v1 users can
 * favorite. TheSportsDB doesn't expose a clean "list of current events"
 * endpoint, so we keep a small set here covering the marquee instances for
 * each supported sport. Extend as new tournaments come into view.
 *
 * The favorite-matcher uses each entry's `id` as `favorites.externalId` and
 * the `startDate`/`endDate` as the metadata window enforcing silent-expire.
 */

import type { EventInstance, Sport } from "@/lib/sportsdb/types";

export type CatalogEvent = EventInstance;

export const EVENTS_CATALOG: readonly CatalogEvent[] = [
  {
    id: "fifa-world-cup-2026",
    name: "FIFA World Cup 2026",
    sport: "Soccer",
    startDate: "2026-06-11",
    endDate: "2026-07-19",
  },
  {
    id: "uefa-euro-2028",
    name: "UEFA Euro 2028",
    sport: "Soccer",
    startDate: "2028-06-09",
    endDate: "2028-07-09",
  },
  {
    id: "nfl-super-bowl-lx",
    name: "Super Bowl LX",
    sport: "American Football",
    startDate: "2026-02-08",
    endDate: "2026-02-08",
  },
  {
    id: "ncaa-tournament-2027",
    name: "NCAA Men's Basketball Tournament 2027",
    sport: "Basketball",
    startDate: "2027-03-16",
    endDate: "2027-04-05",
  },
  {
    id: "wimbledon-2026",
    name: "Wimbledon 2026",
    sport: "Tennis",
    startDate: "2026-06-29",
    endDate: "2026-07-12",
  },
  {
    id: "us-open-tennis-2026",
    name: "US Open (Tennis) 2026",
    sport: "Tennis",
    startDate: "2026-08-31",
    endDate: "2026-09-13",
  },
] as const;

export function searchEventsCatalog(query: string, sportFilter?: Sport) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return EVENTS_CATALOG.filter((e) => {
    if (sportFilter && e.sport !== sportFilter) return false;
    return e.name.toLowerCase().includes(q);
  });
}
