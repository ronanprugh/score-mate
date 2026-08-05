/**
 * Supported ESPN leagues. The aggregator fans out one `scoreboardForLeague`
 * call per (leagueKey ∈ this set, date ∈ widened-5-day window) for every
 * sport any favorite touches.
 *
 * Each `leagueKey` is the canonical ESPN URL segment pair
 * (`{sport}/{league}`). It doubles as the internal `League.id`.
 *
 * Coverage decisions (Spec 03 Q3, Spec 04 Q2):
 *   - American Football: NFL + NCAA FBS.
 *   - Basketball: NBA + WNBA + NCAA men's.
 *   - Soccer: big-5 + MLS + UEFA Champions/Europa/Conf + FIFA World +
 *     CONMEBOL Libertadores + CONCACAF Champions + FA Cup + Carabao Cup.
 *   - Baseball: MLB + NCAA D-I.
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

  // Baseball
  { leagueKey: "baseball/mlb", sport: "Baseball", displayName: "MLB" },
  {
    leagueKey: "baseball/college-baseball",
    sport: "Baseball",
    displayName: "NCAA Baseball",
  },
] as const;

/**
 * Leagues we resolve names for but never fan out over.
 *
 * These exist so a followed team's *own* schedule can include competitions
 * outside its primary league (Spec 13, Unit 2) without those competitions
 * joining the Home feed. The distinction matters: `leagueKeysForSport` drives
 * the home aggregator's per-date fan-out (`lib/home/aggregator.ts:197`), so an
 * entry in `SUPPORTED_LEAGUES` costs one scoreboard call per date for every
 * user following that sport — and puts its fixtures in everyone's Home feed.
 *
 * Club friendlies belong on a followed team's card in preseason, but nobody
 * asked for them in the Home feed (Spec 13, Non-Goal #8).
 */
export const COMPANION_ONLY_LEAGUES: readonly SupportedLeague[] = [
  {
    leagueKey: "soccer/club.friendly",
    sport: "Soccer",
    displayName: "Club Friendly",
  },
] as const;

/**
 * Competitions to check alongside a team's primary league when building that
 * team's schedule, keyed by primary league key.
 *
 * A static map rather than a runtime probe, so the per-team request count is
 * knowable by inspection: a big-5 soccer team costs 1 + this list's length.
 * Only England has domestic cups registered in `SUPPORTED_LEAGUES`, so the
 * other big-5 leagues get friendlies plus the three UEFA competitions.
 */
const UEFA_COMPETITIONS = [
  "soccer/uefa.champions",
  "soccer/uefa.europa",
  "soccer/uefa.europa.conf",
] as const;

export const COMPANION_LEAGUE_KEYS: Readonly<
  Record<string, readonly string[]>
> = {
  "soccer/eng.1": [
    "soccer/club.friendly",
    "soccer/eng.fa",
    "soccer/eng.league_cup",
    ...UEFA_COMPETITIONS,
  ],
  "soccer/esp.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/ita.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/ger.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/fra.1": ["soccer/club.friendly", ...UEFA_COMPETITIONS],
  "soccer/usa.1": ["soccer/club.friendly", "soccer/concacaf.champions"],
};

/**
 * Returns every supported league key whose sport matches the argument.
 * Used by the aggregator to expand a Sport favorite (or any favorite that
 * carries a sport) into the set of league scoreboards we need to fetch.
 *
 * Deliberately reads `SUPPORTED_LEAGUES` only — see `COMPANION_ONLY_LEAGUES`.
 */
export function leagueKeysForSport(sport: Sport): string[] {
  return SUPPORTED_LEAGUES.filter((l) => l.sport === sport).map(
    (l) => l.leagueKey,
  );
}

/**
 * Companion competitions for a team whose primary league is `primaryLeagueKey`.
 * Returns `[]` for single-competition sports (NFL, NBA, MLB) and for any league
 * with no entry, leaving those teams' request counts unchanged.
 */
export function companionLeagueKeys(primaryLeagueKey: string): string[] {
  return [...(COMPANION_LEAGUE_KEYS[primaryLeagueKey] ?? [])];
}

/**
 * Returns the league entry for a key, or `null` if unknown. Used to translate
 * a favorited or fixture-derived league key back into its `Sport` and display
 * name. Searches companion-only leagues too, so a friendly resolves
 * "Club Friendly" rather than falling back to a raw league key.
 */
export function findSupportedLeague(leagueKey: string): SupportedLeague | null {
  return (
    SUPPORTED_LEAGUES.find((l) => l.leagueKey === leagueKey) ??
    COMPANION_ONLY_LEAGUES.find((l) => l.leagueKey === leagueKey) ??
    null
  );
}
