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
 * NOTE: player favorites carry no match data yet — the ESPN athlete-schedule
 * wiring lands in Task 4.0, so the player branch returns null matches for now.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findCatalogTeamById } from "@/lib/espn/catalog";
import { teamScheduleForLeague } from "@/lib/espn/client";
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
  const toEntityMatch = (m: Match): EntityMatch => {
    const isHome = m.homeTeamId === teamId;
    const opponentName = isHome ? m.awayTeamName : m.homeTeamName;
    const hasScore = m.homeScore !== undefined && m.awayScore !== undefined;
    return {
      opponentName,
      date: m.dateUtc,
      score: hasScore ? `${m.homeScore}-${m.awayScore}` : undefined,
      kickoffUtc: m.kickoffUtc,
      leagueName: m.leagueName,
    };
  };

  const sortKey = (m: Match) => m.kickoffUtc ?? `${m.dateUtc}T00:00:00Z`;

  const completed = matches
    .filter((m) => m.status === "final")
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  const upcoming = matches
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return {
    lastMatch: completed[0] ? toEntityMatch(completed[0]) : null,
    nextMatch: upcoming[0] ? toEntityMatch(upcoming[0]) : null,
  };
}

async function buildEntity(
  fav: FavoriteRow,
  errors: string[],
): Promise<TeamEntity> {
  if (fav.type === "player") {
    // Player schedule wiring lands in Task 4.0; return null matches for now so
    // the card degrades gracefully to "Match data unavailable".
    return {
      favoriteId: fav.id,
      displayName: fav.displayName,
      type: "player",
      sport: fav.sport,
      lastMatch: null,
      nextMatch: null,
    };
  }

  const base: TeamEntity = {
    favoriteId: fav.id,
    displayName: fav.displayName,
    type: "team",
    sport: fav.sport,
    lastMatch: null,
    nextMatch: null,
  };

  const catalogTeam = findCatalogTeamById(fav.externalId);
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
