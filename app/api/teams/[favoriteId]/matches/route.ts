/**
 * GET /api/teams/[favoriteId]/matches
 *
 * Powers the entity match-detail screen (Spec 11). Given a followed team or
 * player, returns up to 10 recent (completed) and 10 upcoming matches as
 * fully-populated `Match` objects, so the client can render them with the
 * exact same `MatchCard` / `TennisMatchCard` components as Home.
 *
 * Auth-gated and user-scoped: `favoriteId` is resolved only among the
 * signed-in user's own favorites — an unknown id or another user's id both
 * yield 404, matching the IDOR-safe pattern used elsewhere in this app.
 *
 * Team schedules come from the site-v2 per-team endpoint (already returns
 * full `Match[]`); player schedules come from `athleteMatchHistory` (core-API
 * eventlog, added in Task 3.0). Upstream failures degrade gracefully — 200
 * with empty `recent`/`upcoming` and `source.ok = false` — rather than
 * failing the whole screen.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findCatalogTeamById } from "@/lib/espn/catalog";
import { athleteMatchHistory, teamScheduleForLeague } from "@/lib/espn/client";
import { leagueKeysForSport } from "@/lib/espn/leagues";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import { withServerTiming } from "@/lib/perf/server-timing";
import { splitAndCapSchedule } from "@/lib/teams/schedule";
import type { EntityMatchesEnvelope } from "@/lib/teams/types";

interface RouteContext {
  params: Promise<{ favoriteId: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  return withServerTiming("teams-matches", {}, async () => {
    const { favoriteId } = await ctx.params;
    const favorites = await listFavoritesForUser(userId);
    const favorite = favorites.find(
      (f) => f.id === favoriteId && (f.type === "team" || f.type === "player"),
    );

    if (!favorite) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const errors: string[] = [];

    if (favorite.type === "team") {
      const catalogTeam = findCatalogTeamById(
        favorite.externalId,
        favorite.sport,
        favorite.displayName,
      );
      if (!catalogTeam) {
        errors.push(`Unknown team in catalog: ${favorite.externalId}`);
        const envelope: EntityMatchesEnvelope = {
          entity: {
            favoriteId: favorite.id,
            displayName: favorite.displayName,
            type: "team",
            sport: favorite.sport,
          },
          recent: [],
          upcoming: [],
          source: { ok: false, errors },
        };
        return NextResponse.json(envelope, { status: 200 });
      }

      try {
        const schedule = await teamScheduleForLeague(
          catalogTeam.leagueKey,
          favorite.externalId,
        );
        const { recent, upcoming } = splitAndCapSchedule(schedule);
        const envelope: EntityMatchesEnvelope = {
          entity: {
            favoriteId: favorite.id,
            displayName: favorite.displayName,
            type: "team",
            sport: favorite.sport,
            badgeUrl: catalogTeam.badgeUrl,
          },
          recent,
          upcoming,
          source: { ok: true, errors: [] },
        };
        return NextResponse.json(envelope, { status: 200 });
      } catch (e) {
        errors.push(
          e instanceof Error
            ? e.message
            : `Schedule fetch failed for ${favorite.displayName}`,
        );
        const envelope: EntityMatchesEnvelope = {
          entity: {
            favoriteId: favorite.id,
            displayName: favorite.displayName,
            type: "team",
            sport: favorite.sport,
            badgeUrl: catalogTeam.badgeUrl,
          },
          recent: [],
          upcoming: [],
          source: { ok: false, errors },
        };
        return NextResponse.json(envelope, { status: 200 });
      }
    }

    // Player branch. Athlete lookups are per-league. Prefer the leagueKey
    // captured at favorite time (e.g. soccer/usa.1 for Messi, tennis/atp for
    // Sinner); fall back to the sport's primary league for older favorites.
    const leagueKey =
      favorite.metadata?.leagueKey ?? leagueKeysForSport(favorite.sport)[0];
    if (!leagueKey) {
      const envelope: EntityMatchesEnvelope = {
        entity: {
          favoriteId: favorite.id,
          displayName: favorite.displayName,
          type: "player",
          sport: favorite.sport,
        },
        recent: [],
        upcoming: [],
        source: {
          ok: false,
          errors: [`No league key for sport: ${favorite.sport}`],
        },
      };
      return NextResponse.json(envelope, { status: 200 });
    }

    // athleteMatchHistory never throws — a player ESPN has no usable data for
    // simply resolves to empty arrays, which the client shows as "Match data
    // unavailable" without flipping source.ok (mirrors app/api/teams/route.ts).
    const { recent, upcoming } = await athleteMatchHistory(
      leagueKey,
      favorite.externalId,
    );
    const envelope: EntityMatchesEnvelope = {
      entity: {
        favoriteId: favorite.id,
        displayName: favorite.displayName,
        type: "player",
        sport: favorite.sport,
      },
      recent,
      upcoming,
      source: { ok: true, errors: [] },
    };
    return NextResponse.json(envelope, { status: 200 });
  }); // end withServerTiming
}
