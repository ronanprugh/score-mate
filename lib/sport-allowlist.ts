/**
 * Curated "top matches most people care about" allowlist used by the Sport
 * favorite type. Spec § Non-Goals explicitly forbids sport-wide "all matches"
 * favoriting — a Sport favorite ONLY includes matches whose league/tournament
 * is on the list below for that sport.
 *
 * Entries use TheSportsDB league IDs where they're stable. Entries without a
 * clean single-id mapping (notably US college sports, where the spec calls
 * for "ranked-vs-ranked" filtering) use league-name substring matching as a
 * pragmatic fallback for v1. League IDs may need verification once
 * implementation hits the live API; see spec § Open Questions.
 *
 * Source list: spec 02 § Technical Considerations § Sport favorite allowlist.
 */

import type { Match, Sport } from "./sportsdb/types";

interface AllowlistEntry {
  /** TheSportsDB league id (`idLeague`) when known. */
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
    { leagueId: "4328", label: "English Premier League" },
    { leagueId: "4335", label: "Spanish La Liga" },
    { leagueId: "4332", label: "Italian Serie A" },
    { leagueId: "4331", label: "German Bundesliga" },
    { leagueId: "4334", label: "French Ligue 1" },
    { leagueId: "4346", label: "MLS (Major League Soccer)" },
    { leagueId: "4480", label: "UEFA Champions League" },
    { leagueId: "4481", label: "UEFA Europa League" },
    { leagueId: "4429", label: "FIFA World Cup" },
    { leagueNameContains: "UEFA Euro", label: "UEFA Euros" },
    { leagueNameContains: "Copa America", label: "Copa América" },
    {
      leagueNameContains: "Women's World Cup",
      label: "FIFA Women's World Cup",
    },
  ],
  "American Football": [
    { leagueId: "4391", label: "NFL" },
    {
      leagueNameContains: "College Football Playoff",
      label: "College Football Playoff",
    },
    { leagueNameContains: "Bowl", label: "Major bowl games" },
    // Top-25 NCAA matchups: name-only fallback; the data source's coverage of
    // NCAA FBS is uneven (spec § TheSportsDB coverage gaps). We accept gaps.
    { leagueNameContains: "NCAA Football", label: "NCAA FBS (Top-25 only)" },
  ],
  Basketball: [
    { leagueId: "4387", label: "NBA" },
    { leagueNameContains: "NCAA Basketball", label: "NCAA D-I (Top-25 only)" },
    { leagueNameContains: "NCAA Tournament", label: "March Madness" },
    { leagueNameContains: "WNBA Finals", label: "WNBA Finals" },
  ],
  Tennis: [
    { leagueNameContains: "Australian Open", label: "Australian Open" },
    { leagueNameContains: "Roland", label: "Roland-Garros (French Open)" },
    { leagueNameContains: "Wimbledon", label: "Wimbledon" },
    { leagueNameContains: "US Open", label: "US Open" },
    { leagueNameContains: "ATP Masters 1000", label: "ATP Masters 1000" },
    { leagueNameContains: "WTA 1000", label: "WTA 1000" },
    { leagueNameContains: "ATP Finals", label: "ATP Finals" },
    { leagueNameContains: "WTA Finals", label: "WTA Finals" },
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
