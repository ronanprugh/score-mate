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
      return match.leagueId === fav.externalId;
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
