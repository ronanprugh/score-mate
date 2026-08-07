/**
 * Shared types for the Teams destination (Spec 09).
 *
 * The Teams page renders one entity card per followed team/player, each with
 * a "last match" and "next match" row. These types are the contract between
 * the `/api/teams` route handler, the `TeamsClient` fetcher, and the
 * presentational `EntityCard`.
 */

import type { Match, Sport } from "@/lib/sports/types";

/**
 * A followed team or player with their most recent and next match.
 *
 * Carries full `Match` objects rather than a reduced summary: as of Spec 13
 * the Teams list renders the same `MatchCard` / `TennisMatchCard` components
 * as Home and the entity detail screen, and those need crests, both sides'
 * names, and numeric scores.
 */
export interface TeamEntity {
  /** The `favorites.id` this entity was built from. */
  favoriteId: string;
  displayName: string;
  type: "team" | "player";
  sport: Sport;
  /** Optional crest/badge image URL. */
  badgeUrl?: string;
  lastMatch: Match | null;
  nextMatch: Match | null;
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

/**
 * Response envelope for `GET /api/teams/[favoriteId]/matches` (Spec 11).
 * Carries up to 10 matches per side, where `TeamEntity` carries just the
 * single last/next pair.
 */
export interface EntityMatchesEnvelope {
  entity: {
    favoriteId: string;
    displayName: string;
    type: "team" | "player";
    sport: Sport;
    badgeUrl?: string;
  };
  /** Up to 10 most recent completed matches, most-recent first. */
  recent: Match[];
  /** Up to 10 soonest upcoming matches, soonest first. */
  upcoming: Match[];
  source: {
    /** True when the upstream schedule lookup succeeded. */
    ok: boolean;
    /** Human-readable error strings for failed lookups. */
    errors: string[];
  };
}
