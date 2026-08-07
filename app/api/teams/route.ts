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
 * Both matches are fully-populated `Match` objects, because the Teams list
 * renders the same score cards as Home (Spec 13).
 *
 * Team schedules come from the site-v2 per-team endpoint, fanned out across
 * every competition the team plays (`teamScheduleAcrossCompetitions`); player
 * schedules come from the core-API athlete eventlog (best-effort — see
 * `athleteMatchHistory`) and fall back to null matches ("Match data
 * unavailable") when ESPN has no usable data for the athlete.
 */

import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withServerTiming } from "@/lib/perf/server-timing";
import { findCatalogTeamById } from "@/lib/espn/catalog";
import { athleteMatchHistory } from "@/lib/espn/client";
import { leagueKeysForSport } from "@/lib/espn/leagues";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import { cachedTeamScheduleForLeague } from "@/lib/teams/cached-schedule";
import {
  selectLastAndNext,
  teamScheduleAcrossCompetitions,
} from "@/lib/teams/schedule";
import type { FavoriteRow } from "@/db/schema/favorites";
import type { TeamEntity, TeamsEnvelope } from "@/lib/teams/types";

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
      // Returns full `Match` objects, which the Teams list's score cards need
      // — same source the entity detail screen uses, but capped at one per
      // side: this screen shows a last/next pair, and resolving the detail
      // screen's 10 would cost ~20 discarded linescore fetches per tennis
      // player.
      //
      // Key is distinct from Spec 11's `teams-athlete-schedule`: that entry
      // cached a `{ lastMatch, nextMatch }` summary, and reusing the key would
      // let a surviving entry deserialize into `recent === undefined`.
      const { recent, upcoming } = await unstable_cache(
        () => athleteMatchHistory(leagueKey, fav.externalId, { cap: 1 }),
        ["teams-athlete-last-next", leagueKey, fav.externalId],
        { revalidate: 300 },
      )();
      // athleteMatchHistory never throws; a graceful empty result for a player
      // ESPN has no data on shouldn't flip source.ok — the card just shows
      // "Match data unavailable".
      return {
        ...playerBase,
        lastMatch: recent[0] ?? null,
        nextMatch: upcoming[0] ?? null,
      };
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
    // Fans out across the team's cups, continental competitions, and
    // friendlies — not just their primary league. Each competition is cached
    // independently; an empty one (team isn't in that cup) is normal and
    // contributes no error.
    //
    // Only the primary league's failure lands in `errors`. A flaky companion
    // competition costs at most a cup tie, and with 7 competitions per team
    // it would otherwise be the common case for the error banner.
    const { matches, errors: fanoutErrors } =
      await teamScheduleAcrossCompetitions(
        catalogTeam.leagueKey,
        fav.externalId,
        { fetchLeagueSchedule: cachedTeamScheduleForLeague },
      );
    errors.push(...fanoutErrors);
    const { lastMatch, nextMatch } = selectLastAndNext(matches);
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

  const userId = session.user.id;
  return withServerTiming("teams", {}, async () => {
    const favorites = await listFavoritesForUser(userId);
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
  });
}
