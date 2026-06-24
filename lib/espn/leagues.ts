/**
 * Supported ESPN leagues. The aggregator fans out one `scoreboardForLeague`
 * call per (leagueKey ∈ this set, date ∈ widened-5-day window) for every
 * sport any favorite touches.
 *
 * Each `leagueKey` is the canonical ESPN URL segment pair
 * (`{sport}/{league}`). It doubles as the internal `League.id`.
 *
 * Coverage decisions (Spec 03 Q3):
 *   - American Football: NFL + NCAA FBS.
 *   - Basketball: NBA + WNBA + NCAA men's.
 *   - Soccer: big-5 + MLS + UEFA Champions/Europa/Conf + FIFA World +
 *     CONMEBOL Libertadores + CONCACAF Champions + FA Cup + Carabao Cup.
 *
 * To extend coverage, add an entry here and re-run
 * `pnpm tsx scripts/refresh-espn-catalog.ts` (added in T3.1) to refresh
 * the committed team/league catalog.
 */

import type { Sport } from "@/lib/sports/types";

export interface SupportedLeague {
  /** ESPN URL segment pair, e.g. `"soccer/eng.1"`. */
  leagueKey: string;
  sport: Sport;
  displayName: string;
}

export const SUPPORTED_LEAGUES: readonly SupportedLeague[] = [
  // American Football
  { leagueKey: "football/nfl", sport: "American Football", displayName: "NFL" },
  {
    leagueKey: "football/college-football",
    sport: "American Football",
    displayName: "NCAA Football",
  },

  // Basketball
  { leagueKey: "basketball/nba", sport: "Basketball", displayName: "NBA" },
  { leagueKey: "basketball/wnba", sport: "Basketball", displayName: "WNBA" },
  {
    leagueKey: "basketball/mens-college-basketball",
    sport: "Basketball",
    displayName: "NCAA Men's Basketball",
  },

  // Soccer
  { leagueKey: "soccer/eng.1", sport: "Soccer", displayName: "Premier League" },
  { leagueKey: "soccer/esp.1", sport: "Soccer", displayName: "La Liga" },
  { leagueKey: "soccer/ita.1", sport: "Soccer", displayName: "Serie A" },
  { leagueKey: "soccer/ger.1", sport: "Soccer", displayName: "Bundesliga" },
  { leagueKey: "soccer/fra.1", sport: "Soccer", displayName: "Ligue 1" },
  { leagueKey: "soccer/usa.1", sport: "Soccer", displayName: "MLS" },
  {
    leagueKey: "soccer/uefa.champions",
    sport: "Soccer",
    displayName: "UEFA Champions League",
  },
  {
    leagueKey: "soccer/uefa.europa",
    sport: "Soccer",
    displayName: "UEFA Europa League",
  },
  {
    leagueKey: "soccer/uefa.europa.conf",
    sport: "Soccer",
    displayName: "UEFA Conference League",
  },
  {
    leagueKey: "soccer/fifa.world",
    sport: "Soccer",
    displayName: "FIFA World Cup",
  },
  {
    leagueKey: "soccer/conmebol.libertadores",
    sport: "Soccer",
    displayName: "Copa Libertadores",
  },
  {
    leagueKey: "soccer/concacaf.champions",
    sport: "Soccer",
    displayName: "CONCACAF Champions Cup",
  },
  { leagueKey: "soccer/eng.fa", sport: "Soccer", displayName: "FA Cup" },
  {
    leagueKey: "soccer/eng.league_cup",
    sport: "Soccer",
    displayName: "Carabao Cup",
  },
] as const;

/**
 * Returns every supported league key whose sport matches the argument.
 * Used by the aggregator to expand a Sport favorite (or any favorite that
 * carries a sport) into the set of league scoreboards we need to fetch.
 */
export function leagueKeysForSport(sport: Sport): string[] {
  return SUPPORTED_LEAGUES.filter((l) => l.sport === sport).map(
    (l) => l.leagueKey,
  );
}

/**
 * Returns the supported-league entry for a key, or `null` if the key
 * isn't in `SUPPORTED_LEAGUES`. Used to translate a favorited league key
 * back into its `Sport` and display name.
 */
export function findSupportedLeague(leagueKey: string): SupportedLeague | null {
  return SUPPORTED_LEAGUES.find((l) => l.leagueKey === leagueKey) ?? null;
}
