/**
 * Shared types for the Teams destination (Spec 09).
 *
 * The Teams page renders one entity card per followed team/player, each with
 * a "last match" and "next match" row. These types are the contract between
 * the `/api/teams` route handler, the `TeamsClient` fetcher, and the
 * presentational `EntityCard`.
 */

import type { Sport } from "@/lib/sports/types";

/** One match row (last or next) on an entity card. */
export interface EntityMatch {
  /** The other side of the fixture, relative to the followed entity. */
  opponentName: string;
  /** YYYY-MM-DD (UTC) of the match. */
  date: string;
  /** Formatted score for completed matches (e.g. "2-1"); omitted when upcoming. */
  score?: string;
  /** ISO 8601 kickoff timestamp; null when TBD. */
  kickoffUtc?: string | null;
  /** Human-readable league/competition name. */
  leagueName: string;
}

/** A followed team or player with their most recent and next match. */
export interface TeamEntity {
  /** The `favorites.id` this entity was built from. */
  favoriteId: string;
  displayName: string;
  type: "team" | "player";
  sport: Sport;
  /** Optional crest/badge image URL. */
  badgeUrl?: string;
  lastMatch: EntityMatch | null;
  nextMatch: EntityMatch | null;
}

/** Response envelope for `GET /api/teams`. */
export interface TeamsEnvelope {
  entities: TeamEntity[];
  source: {
    /** True when every upstream lookup succeeded. */
    ok: boolean;
    /** Human-readable error strings for each failed lookup. */
    errors: string[];
  };
}
