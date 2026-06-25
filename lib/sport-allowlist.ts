/**
 * Curated "top matches most people care about" allowlist used by the Sport
 * favorite type. Spec § Non-Goals explicitly forbids sport-wide "all matches"
 * favoriting — a Sport favorite ONLY includes matches whose league/tournament
 * is on the list below for that sport.
 *
 * Entries use ESPN `{sport}/{league}` keys (the canonical `leagueId` in our
 * provider-neutral types) where possible. League-name substring matching is
 * a pragmatic fallback for tournaments without a stable per-league endpoint
 * (e.g. seasonal cups, Top-25 NCAA matchups inside a parent league).
 *
 * Tennis is dropped in Spec 03 (ESPN backend swap, Q3 (G)).
 * Baseball (MLB + NCAA D-I + College World Series) added in Spec 04.
 *
 * Source list: spec 02 § Technical Considerations § Sport favorite allowlist,
 * remapped to ESPN league keys by Spec 03; extended for Baseball by Spec 04.
 */

import type { Match, Sport } from "./sports/types";

interface AllowlistEntry {
  /** ESPN `{sport}/{league}` key when known. */
  leagueId?: string;
  /**
   * Case-insensitive substring used as a fallback when `leagueId` is absent
   * or when the source's league naming is fuzzy (e.g. seasonal cups).
   */
  leagueNameContains?: string;
  /** Human-readable label for code review. */
  label: string;
}

export const SPORT_ALLOWLIST: Record<Sport, AllowlistEntry[]> = {
  Soccer: [
    { leagueId: "soccer/eng.1", label: "English Premier League" },
    { leagueId: "soccer/esp.1", label: "Spanish La Liga" },
    { leagueId: "soccer/ita.1", label: "Italian Serie A" },
    { leagueId: "soccer/ger.1", label: "German Bundesliga" },
    { leagueId: "soccer/fra.1", label: "French Ligue 1" },
    { leagueId: "soccer/usa.1", label: "MLS (Major League Soccer)" },
    { leagueId: "soccer/uefa.champions", label: "UEFA Champions League" },
    { leagueId: "soccer/uefa.europa", label: "UEFA Europa League" },
    { leagueId: "soccer/fifa.world", label: "FIFA World Cup" },
    { leagueNameContains: "UEFA Euro", label: "UEFA Euros" },
    { leagueNameContains: "Copa America", label: "Copa América" },
    {
      leagueNameContains: "Women's World Cup",
      label: "FIFA Women's World Cup",
    },
  ],
  "American Football": [
    { leagueId: "football/nfl", label: "NFL" },
    {
      leagueNameContains: "College Football Playoff",
      label: "College Football Playoff",
    },
    { leagueNameContains: "Bowl", label: "Major bowl games" },
    // Top-25 NCAA matchups: name-only fallback within ESPN's college-football
    // league. The Top-25 ranking signal isn't in ESPN's scoreboard payload,
    // so v1 accepts all FBS games tagged "NCAA Football"; tightening to
    // ranked-only is a follow-up.
    { leagueId: "football/college-football", label: "NCAA FBS" },
  ],
  Basketball: [
    { leagueId: "basketball/nba", label: "NBA" },
    {
      leagueId: "basketball/mens-college-basketball",
      label: "NCAA D-I",
    },
    { leagueNameContains: "NCAA Tournament", label: "March Madness" },
    { leagueId: "basketball/wnba", label: "WNBA" },
  ],
  Baseball: [
    { leagueId: "baseball/mlb", label: "MLB" },
    {
      leagueId: "baseball/college-baseball",
      label: "NCAA D-I Baseball",
    },
    { leagueNameContains: "College World Series", label: "College World Series" },
  ],
};

/**
 * Returns true if the given match falls into the curated allowlist for its
 * own sport. Used by `favorite-matcher.ts` for type='sport' favorites.
 */
export function matchesSportAllowlist(sport: Sport, match: Match): boolean {
  if (match.sport !== sport) return false;
  const entries = SPORT_ALLOWLIST[sport];
  const leagueNameLower = match.leagueName.toLowerCase();
  return entries.some((entry) => {
    if (entry.leagueId && entry.leagueId === match.leagueId) return true;
    if (
      entry.leagueNameContains &&
      leagueNameLower.includes(entry.leagueNameContains.toLowerCase())
    ) {
      return true;
    }
    return false;
  });
}
