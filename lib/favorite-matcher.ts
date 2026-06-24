/**
 * Pure function: given a list of user favorites and a list of candidate
 * matches, return the deduplicated set of matches that any favorite would
 * "claim." The four favorite-type semantics are:
 *
 *   - team   : match.homeTeamId === fav.externalId || match.awayTeamId === fav.externalId
 *   - sport  : match.sport === fav.sport AND matchesSportAllowlist(sport, match)
 *   - league : match.leagueId === fav.externalId
 *   - event  : match.eventInstanceId === fav.externalId AND
 *              match.dateUtc within fav.metadata.startDate..endDate (inclusive)
 *
 * "Silent-expire" for Event favorites: if today is outside the favorite's
 * stored date window, it produces ZERO matches even when the event id would
 * otherwise match. The favorite row stays on the user's list (no archival);
 * it just stops contributing matches. This is the spec-mandated behavior so
 * an old "World Cup 2022" favorite doesn't surface 2026 World Cup games.
 *
 * Dedup key: `match.id`. A match that's matched by multiple favorites
 * (e.g. favoriting both "Team USA" and "FIFA World Cup 2026") appears once.
 */

import { matchesSportAllowlist } from "./sport-allowlist";
import type { Favorite, Match } from "./sportsdb/types";

/**
 * "Container" leagues in TheSportsDB (e.g. ATP World Tour, WTA World Tour)
 * have their own `idLeague` but no actual matches at that id — matches sit
 * under the per-tournament child league rows. This map lets a user's
 * existing favorite for those leagues match by leagueName substring even
 * if the favorite was stored before we started auto-attaching
 * `metadata.leagueNameContains` at the search layer.
 *
 * Keyed by `Favorite.displayName` because that's what the user actually
 * clicked on in the search results.
 */
const KNOWN_CONTAINER_LEAGUE_NAME_CONTAINS: Readonly<Record<string, string>> = {
  "ATP World Tour": "ATP",
  // TheSportsDB calls this league "WTA Tour" (idLeague 4517); the leading
  // "World" in the user-facing label was wrong on first ship.
  "WTA Tour": "WTA",
};

function leagueClaimsMatch(fav: Favorite, match: Match): boolean {
  if (match.leagueId === fav.externalId) return true;
  const contains =
    fav.metadata?.leagueNameContains ??
    KNOWN_CONTAINER_LEAGUE_NAME_CONTAINS[fav.displayName];
  if (!contains) return false;
  return match.leagueName.toLowerCase().includes(contains.toLowerCase());
}

function withinEventWindow(match: Match, fav: Favorite): boolean {
  const start = fav.metadata?.startDate;
  const end = fav.metadata?.endDate;
  // If we don't know the window, default to "no match" — better to miss than
  // to surface stale matches under an expired tournament favorite.
  if (!start || !end) return false;
  return match.dateUtc >= start && match.dateUtc <= end;
}

function favoriteClaimsMatch(fav: Favorite, match: Match): boolean {
  switch (fav.type) {
    case "team":
      return (
        match.homeTeamId === fav.externalId ||
        match.awayTeamId === fav.externalId
      );
    case "sport":
      return matchesSportAllowlist(fav.sport, match);
    case "league":
      return leagueClaimsMatch(fav, match);
    case "event":
      return (
        match.eventInstanceId === fav.externalId &&
        withinEventWindow(match, fav)
      );
  }
}

/**
 * Returns the matches that at least one favorite claims, deduplicated by
 * `match.id`. Input order of matches is preserved in the output.
 */
export function matchFavoritesAgainstMatches(
  favorites: readonly Favorite[],
  matches: readonly Match[],
): Match[] {
  const out: Match[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.id)) continue;
    if (favorites.some((f) => favoriteClaimsMatch(f, m))) {
      out.push(m);
      seen.add(m.id);
    }
  }
  return out;
}
