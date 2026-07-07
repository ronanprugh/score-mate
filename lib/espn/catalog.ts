/**
 * In-memory team/league catalog loaded from `lib/espn/catalog.json`.
 *
 * The catalog is a committed snapshot produced by
 * `scripts/refresh-espn-catalog.ts`. Searching it in memory replaces the
 * runtime TheSportsDB `searchteams` / `search_all_leagues` calls — same
 * UX (typeahead on the Favorites screen) but deterministic, cache-free,
 * and offline-safe in tests.
 *
 * Team display names can collide across leagues (e.g. several college
 * football teams are nicknamed "Lakers"; "Liverpool" appears in both
 * Premier League and Copa Libertadores). The route layer is responsible
 * for de-duping / capping; this layer just returns substring matches in
 * a stable order.
 */

import catalogJson from "./catalog.json" with { type: "json" };
import type { League, Sport, Team } from "@/lib/sports/types";

interface RawCatalogTeam {
  id: string;
  name: string;
  sport?: Sport;
  badgeUrl?: string;
  leagueKey: string;
}

interface RawCatalogLeague {
  id: string;
  name: string;
  sport: Sport;
}

interface RawCatalog {
  generatedAt: string;
  leagues: RawCatalogLeague[];
  teams: RawCatalogTeam[];
}

export type CatalogTeam = Team & { leagueKey: string };

const CATALOG = catalogJson as RawCatalog;

export const CATALOG_GENERATED_AT: string = CATALOG.generatedAt;
export const ALL_CATALOG_TEAMS: readonly CatalogTeam[] = CATALOG.teams;
export const ALL_CATALOG_LEAGUES: readonly League[] = CATALOG.leagues;

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Returns every team whose name contains `query` (case-insensitive),
 * optionally narrowed to a single sport. Results are returned in the
 * deterministic order the catalog was written in (by sport, then league,
 * then id) — callers cap the list.
 */
export function searchCatalogTeams(
  query: string,
  sportFilter?: Sport,
): CatalogTeam[] {
  const q = query.trim();
  if (!q) return [];
  return ALL_CATALOG_TEAMS.filter((t) => {
    if (sportFilter && t.sport !== sportFilter) return false;
    return includesCaseInsensitive(t.name, q);
  });
}

/**
 * Resolves a committed catalog team by its ESPN team id. Used by the
 * `/api/teams` route to recover a team favorite's `leagueKey` (needed to
 * call the ESPN team-schedule endpoint) from its stored `externalId`.
 * Returns `null` when the id is not in the catalog.
 */
export function findCatalogTeamById(id: string): CatalogTeam | null {
  return ALL_CATALOG_TEAMS.find((t) => t.id === id) ?? null;
}

/**
 * Returns every league whose name contains `query` (case-insensitive),
 * optionally narrowed to a single sport.
 */
export function searchCatalogLeagues(
  query: string,
  sportFilter?: Sport,
): League[] {
  const q = query.trim();
  if (!q) return [];
  return ALL_CATALOG_LEAGUES.filter((l) => {
    if (sportFilter && l.sport !== sportFilter) return false;
    return includesCaseInsensitive(l.name, q);
  });
}
