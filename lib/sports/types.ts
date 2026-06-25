/**
 * Internal, normalized types for sports data.
 *
 * Provider-neutral. The current backend (`lib/espn/`) maps ESPN's raw
 * responses into these shapes so the rest of the app never depends on a
 * specific upstream provider. If we ever swap providers again, only the
 * client + this file change.
 */

export type Sport = "Soccer" | "American Football" | "Basketball" | "Baseball";

export const SUPPORTED_SPORTS: readonly Sport[] = [
  "Soccer",
  "American Football",
  "Basketball",
  "Baseball",
] as const;

export type FavoriteType = "team" | "sport" | "league" | "event";

export const FAVORITE_TYPES: readonly FavoriteType[] = [
  "team",
  "sport",
  "league",
  "event",
] as const;

export type MatchStatus = "final" | "live" | "upcoming";

export interface Team {
  /** Provider team id (ESPN `team.id`). Stable across requests. */
  id: string;
  name: string;
  /** Normalized sport (when the provider returns one of our supported set). */
  sport?: Sport;
  /** Optional crest image URL when provided by the source. */
  badgeUrl?: string;
}

export interface League {
  /** Provider league key (ESPN `{sport}/{league}`, e.g. `"soccer/eng.1"`). */
  id: string;
  name: string;
  sport: Sport;
}

/**
 * A tournament instance (e.g. "FIFA World Cup 2026"). We treat these as
 * their own concept because the spec lets users favorite a specific
 * instance.
 */
export interface EventInstance {
  /** Opaque id used as `favorites.externalId` for type='event' favorites. */
  id: string;
  name: string;
  sport: Sport;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD inclusive
  /**
   * Provider league key (ESPN `{sport}/{league}`) when the tournament maps
   * cleanly to one. Used by the aggregator to tag incoming matches with
   * this event instance so type='event' favorites match. Either this or
   * `leagueNameContains` should be present.
   */
  leagueId?: string;
  /**
   * Case-insensitive substring matched against `match.leagueName` when
   * `leagueId` is absent (or as a secondary signal). Pragmatic fallback
   * for tournaments whose league key doesn't uniquely identify the
   * instance (e.g. the Super Bowl sits inside `football/nfl`).
   */
  leagueNameContains?: string;
}

export interface Match {
  /** Provider event id (ESPN `event.id`). Used as the dedup key. */
  id: string;
  sport: Sport;

  homeTeamId: string;
  homeTeamName: string;
  /** Short name / mascot (e.g. "Chiefs" for "Kansas City Chiefs"). */
  homeTeamShortName?: string;
  /** Optional crest/logo URL for the home team when the provider returns one. */
  homeTeamLogo?: string;
  awayTeamId: string;
  awayTeamName: string;
  /** Short name / mascot (e.g. "Lakers" for "Los Angeles Lakers"). */
  awayTeamShortName?: string;
  /** Optional crest/logo URL for the away team when the provider returns one. */
  awayTeamLogo?: string;

  /** Provider league key (ESPN `{sport}/{league}`). */
  leagueId: string;
  leagueName: string;

  /** Tournament-instance id when this match belongs to a known instance. */
  eventInstanceId?: string;

  /** YYYY-MM-DD in UTC. */
  dateUtc: string;
  /** ISO 8601 kickoff timestamp, nullable when TBD. */
  kickoffUtc: string | null;

  round?: string;
  venue?: string;
  /** Broadcast channel / streaming info when the source provides it. */
  broadcast?: string;

  status: MatchStatus;
  /** Present when `status === 'final'` or `'live'`. */
  homeScore?: number;
  awayScore?: number;
  /** Human-readable progress for live matches (e.g. "73'", "Q3 8:21", "Set 2"). */
  liveProgress?: string;
}

/**
 * The shape `favorite-matcher.ts` consumes. Mirrors `db/schema/favorites.ts`
 * but lives here so this lib doesn't depend on the DB layer.
 */
export interface Favorite {
  id: string;
  userId: string;
  type: FavoriteType;
  /** Provider id for team/league/event; sport name for type='sport'. */
  externalId: string;
  displayName: string;
  sport: Sport;
  /** For type='event': `{ startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }`. */
  metadata?: {
    startDate?: string;
    endDate?: string;
    leagueNameContains?: string;
  } | null;
}
