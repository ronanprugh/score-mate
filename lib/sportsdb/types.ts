/**
 * Internal, normalized types for sports data.
 *
 * The `lib/sportsdb/client.ts` layer maps TheSportsDB's raw responses into
 * these shapes so the rest of the app never depends on TheSportsDB's exact
 * field names. If we ever swap providers, only the client + this file change.
 */

export type Sport = "Soccer" | "American Football" | "Basketball" | "Tennis";

export const SUPPORTED_SPORTS: readonly Sport[] = [
  "Soccer",
  "American Football",
  "Basketball",
  "Tennis",
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
  /** TheSportsDB team id (`idTeam`). Stable across requests. */
  id: string;
  name: string;
  /** Normalized sport (when TheSportsDB returns one of our four). */
  sport?: Sport;
  /** Optional crest image URL when provided by the source. */
  badgeUrl?: string;
}

export interface League {
  /** TheSportsDB league id (`idLeague`). Stable across requests. */
  id: string;
  name: string;
  sport: Sport;
}

/**
 * A tournament instance (e.g. "FIFA World Cup 2026"). In TheSportsDB these
 * correspond to season ids on top of a league/cup; we treat them as their
 * own concept because the spec lets users favorite a specific instance.
 */
export interface EventInstance {
  /** Opaque id used as `favorites.externalId` for type='event' favorites. */
  id: string;
  name: string;
  sport: Sport;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD inclusive
  /**
   * TheSportsDB league id (`idLeague`) when the tournament maps cleanly to
   * one. Used by the aggregator to tag incoming matches with this event
   * instance so type='event' favorites match. Either this or
   * `leagueNameContains` should be present.
   */
  leagueId?: string;
  /**
   * Case-insensitive substring matched against `match.leagueName` when
   * `leagueId` is absent (or as a secondary signal). Pragmatic v1 fallback
   * for tournaments whose league id isn't stable across TheSportsDB endpoints.
   */
  leagueNameContains?: string;
}

export interface Match {
  /** TheSportsDB event id (`idEvent`). Used as the dedup key. */
  id: string;
  sport: Sport;

  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;

  /** TheSportsDB league id (`idLeague`). */
  leagueId: string;
  leagueName: string;

  /** Tournament-instance id when this match belongs to a known instance. */
  eventInstanceId?: string;

  /** YYYY-MM-DD in UTC (TheSportsDB `dateEvent`). */
  dateUtc: string;
  /** ISO 8601 kickoff timestamp (`strTimestamp`), nullable when TBD. */
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
  /** TheSportsDB id for team/league/event; sport name for type='sport'. */
  externalId: string;
  displayName: string;
  sport: Sport;
  /** For type='event': `{ startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }`. */
  metadata?: { startDate?: string; endDate?: string } | null;
}
