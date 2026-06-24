/**
 * Hand-curated catalog of tournament/event instances that v1 users can
 * favorite. ESPN doesn't expose a clean "list of current events" endpoint,
 * so we keep a small set here covering the marquee instances for each
 * supported sport. Extend as new tournaments come into view.
 *
 * The favorite-matcher uses each entry's `id` as `favorites.externalId` and
 * the `startDate`/`endDate` as the metadata window enforcing silent-expire.
 *
 * Each entry should also carry `leagueId` (the ESPN `{sport}/{league}` key)
 * or a `leagueNameContains` fallback so the aggregator can tag incoming
 * matches with `eventInstanceId` — without that link, type='event'
 * favorites would never match anything in the live data.
 *
 * Tournament-instances that sit *inside* a parent league (e.g. the Super
 * Bowl inside `football/nfl`) use both `leagueId` (for routing the fetch)
 * and `leagueNameContains` (to disambiguate the instance within the
 * parent league's match stream).
 */

import type { EventInstance, Match, Sport } from "@/lib/sports/types";

export type CatalogEvent = EventInstance;

export const EVENTS_CATALOG: readonly CatalogEvent[] = [
  {
    id: "fifa-world-cup-2026",
    name: "FIFA World Cup 2026",
    sport: "Soccer",
    startDate: "2026-06-11",
    endDate: "2026-07-19",
    leagueId: "soccer/fifa.world",
  },
  {
    id: "uefa-euro-2028",
    name: "UEFA Euro 2028",
    sport: "Soccer",
    startDate: "2028-06-09",
    endDate: "2028-07-09",
    // No dedicated ESPN league key for the Euros in SUPPORTED_LEAGUES yet;
    // matches surface via name fallback when they land.
    leagueNameContains: "UEFA Euro",
  },
  {
    id: "nfl-super-bowl-lx",
    name: "Super Bowl LX",
    sport: "American Football",
    startDate: "2026-02-08",
    endDate: "2026-02-08",
    leagueId: "football/nfl",
    leagueNameContains: "Super Bowl",
  },
  {
    id: "ncaa-tournament-2027",
    name: "NCAA Men's Basketball Tournament 2027",
    sport: "Basketball",
    startDate: "2027-03-16",
    endDate: "2027-04-05",
    leagueId: "basketball/mens-college-basketball",
    leagueNameContains: "NCAA Tournament",
  },
] as const;

export function findEventInstanceById(id: string): CatalogEvent | null {
  return EVENTS_CATALOG.find((e) => e.id === id) ?? null;
}

export function searchEventsCatalog(query: string, sportFilter?: Sport) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return EVENTS_CATALOG.filter((e) => {
    if (sportFilter && e.sport !== sportFilter) return false;
    return e.name.toLowerCase().includes(q);
  });
}

/**
 * Returns the first catalog entry whose sport, league mapping, and date
 * window all claim the given match — or `null` if none do. The match's
 * `dateUtc` must fall within `[startDate, endDate]` inclusive; the sport
 * must match exactly; and either `leagueId` must equal `match.leagueId`
 * AND (if `leagueNameContains` is present) the league name must contain
 * that substring, OR `leagueNameContains` alone must match when no
 * `leagueId` is set on the catalog entry.
 */
export function findEventInstanceForMatch(match: Match): CatalogEvent | null {
  const leagueNameLower = match.leagueName.toLowerCase();
  for (const e of EVENTS_CATALOG) {
    if (e.sport !== match.sport) continue;
    if (match.dateUtc < e.startDate || match.dateUtc > e.endDate) continue;
    if (e.leagueId && e.leagueId === match.leagueId) {
      // If a name filter is set too, require it (Super-Bowl-in-NFL case).
      if (
        e.leagueNameContains &&
        !leagueNameLower.includes(e.leagueNameContains.toLowerCase())
      ) {
        continue;
      }
      return e;
    }
    if (
      !e.leagueId &&
      e.leagueNameContains &&
      leagueNameLower.includes(e.leagueNameContains.toLowerCase())
    ) {
      return e;
    }
  }
  return null;
}

/**
 * Returns a copy of `match` with `eventInstanceId` populated if the catalog
 * claims it. Preserves any pre-existing `eventInstanceId` (defensive — we
 * trust an upstream-provided id if one ever lands).
 */
export function enrichMatchWithEventInstance(match: Match): Match {
  if (match.eventInstanceId) return match;
  const e = findEventInstanceForMatch(match);
  if (!e) return match;
  return { ...match, eventInstanceId: e.id };
}
