/**
 * GET /api/teams
 *
 * Powers the Teams destination. Returns one `TeamEntity` per followed team or
 * player, each carrying the entity's most recently completed match
 * (`lastMatch`) and soonest upcoming match (`nextMatch`).
 *
 * Auth-gated. Partial upstream failures return 200 with `source.ok = false`
 * and the affected entity carrying null matches — the UI degrades gracefully
 * rather than failing the whole page.
 *
 * Team schedules come from the site-v2 per-team endpoint; player schedules
 * come from the core-API athlete eventlog (best-effort — see `athleteSchedule`)
 * and fall back to null matches ("Match data unavailable") when ESPN has no
 * usable data for the athlete.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findCatalogTeamById } from "@/lib/espn/catalog";
import { athleteSchedule, teamScheduleForLeague } from "@/lib/espn/client";
import { leagueKeysForSport } from "@/lib/espn/leagues";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import type { FavoriteRow } from "@/db/schema/favorites";
import type { Match } from "@/lib/sports/types";
import type { EntityMatch, TeamEntity, TeamsEnvelope } from "@/lib/teams/types";

/**
 * Reduces a team's full schedule to a last (most recent completed) and next
 * (soonest upcoming) match, expressed relative to the followed team.
 */
export function extractEntityMatches(
  matches: readonly Match[],
  teamId: string,
): { lastMatch: EntityMatch | null; nextMatch: EntityMatch | null } {
  const toEntityMatch = (m: Match, completed: boolean): EntityMatch => {
    const isHome = m.homeTeamId === teamId;
    const opponentName = isHome ? m.awayTeamName : m.homeTeamName;
    const match: EntityMatch = {
      opponentName,
      date: m.dateUtc,
      kickoffUtc: m.kickoffUtc,
      leagueName: m.leagueName,
    };
    // Score/result only for completed games, from the followed team's side.
    if (completed && m.homeScore !== undefined && m.awayScore !== undefined) {
      const mine = isHome ? m.homeScore : m.awayScore;
      const theirs = isHome ? m.awayScore : m.homeScore;
      match.score = `${mine}-${theirs}`;
      if (mine > theirs) match.result = "W";
      else if (mine < theirs) match.result = "L";
    }
    return match;
  };

  const sortKey = (m: Match) => m.kickoffUtc ?? `${m.dateUtc}T00:00:00Z`;

  const completed = matches
    .filter((m) => m.status === "final")
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  const upcoming = matches
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return {
    lastMatch: completed[0] ? toEntityMatch(completed[0], true) : null,
    nextMatch: upcoming[0] ? toEntityMatch(upcoming[0], false) : null,
  };
}

async function buildEntity(
  fav: FavoriteRow,
  errors: string[],
): Promise<TeamEntity> {
  if (fav.type === "player") {
    const playerBase: TeamEntity = {
      favoriteId: fav.id,
      displayName: fav.displayName,
      type: "player",
      sport: fav.sport,
      lastMatch: null,
      nextMatch: null,
    };
    // Athlete lookups are per-league. Prefer the athlete's own league captured
    // at favorite time (e.g. soccer/usa.1 for Messi, tennis/wta for Gauff);
    // fall back to the sport's primary league for older favorites.
    const leagueKey =
      fav.metadata?.leagueKey ?? leagueKeysForSport(fav.sport)[0];
    if (!leagueKey) {
      errors.push(`No league key for sport: ${fav.sport}`);
      return playerBase;
    }
    try {
      const { lastMatch, nextMatch } = await athleteSchedule(
        leagueKey,
        fav.externalId,
      );
      // athleteSchedule never throws, but a graceful null result for a player
      // ESPN has no data on shouldn't flip source.ok — the card just shows
      // "Match data unavailable".
      return { ...playerBase, lastMatch, nextMatch };
    } catch (e) {
      errors.push(
        e instanceof Error
          ? e.message
          : `Athlete schedule failed for ${fav.displayName}`,
      );
      return playerBase;
    }
  }

  const base: TeamEntity = {
    favoriteId: fav.id,
    displayName: fav.displayName,
    type: "team",
    sport: fav.sport,
    lastMatch: null,
    nextMatch: null,
  };

  // Disambiguate by sport + name: ESPN team ids collide across sports/leagues.
  const catalogTeam = findCatalogTeamById(
    fav.externalId,
    fav.sport,
    fav.displayName,
  );
  if (!catalogTeam) {
    errors.push(`Unknown team in catalog: ${fav.externalId}`);
    return base;
  }
  if (catalogTeam.badgeUrl) base.badgeUrl = catalogTeam.badgeUrl;

  try {
    const schedule = await teamScheduleForLeague(
      catalogTeam.leagueKey,
      fav.externalId,
    );
    const { lastMatch, nextMatch } = extractEntityMatches(
      schedule,
      fav.externalId,
    );
    return { ...base, lastMatch, nextMatch };
  } catch (e) {
    errors.push(
      e instanceof Error
        ? e.message
        : `Schedule fetch failed for ${fav.displayName}`,
    );
    return base;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const favorites = await listFavoritesForUser(session.user.id);
  const entityFavorites = favorites.filter(
    (f) => f.type === "team" || f.type === "player",
  );

  const errors: string[] = [];
  const entities = await Promise.all(
    entityFavorites.map((fav) => buildEntity(fav, errors)),
  );

  const envelope: TeamsEnvelope = {
    entities,
    source: { ok: errors.length === 0, errors },
  };
  return NextResponse.json(envelope, { status: 200 });
}
