/**
 * GET /api/favorites/search?q=...&sport=...
 *
 * Powers the typeahead on the Favorites screen. Calls TheSportsDB
 * `searchteams` + `search_all_leagues` (across all supported sports in
 * parallel) and merges them with the hand-curated events catalog plus a
 * sport-name match into a single type-labeled result list.
 *
 * Each result is `{ type, externalId, displayName, sport, metadata? }` —
 * exactly the shape POST /api/favorites accepts. The client sends a result
 * back unchanged via FavoriteAddButton.
 *
 * Auth-gated. Uses `Promise.allSettled` so partial upstream failures don't
 * blank the whole result set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { searchEventsCatalog } from "@/lib/events-catalog";
import { searchAllLeagues, searchTeams } from "@/lib/sportsdb/client";
import {
  SUPPORTED_SPORTS,
  type FavoriteType,
  type Sport,
} from "@/lib/sports/types";

interface SearchResult {
  type: FavoriteType;
  externalId: string;
  displayName: string;
  sport: Sport;
  metadata?: {
    startDate?: string;
    endDate?: string;
    leagueNameContains?: string;
  };
}

/**
 * "Container" leagues whose own `idLeague` returns no matches because the
 * actual events sit under per-tournament child league rows. We tag the
 * search result with `metadata.leagueNameContains` so the favorite saves
 * with a fuzzy fallback the matcher honors.
 */
const CONTAINER_LEAGUE_NAME_CONTAINS: Readonly<Record<string, string>> = {
  "ATP World Tour": "ATP",
  "WTA Tour": "WTA",
};

function isSupportedSport(s: string | null): s is Sport {
  return SUPPORTED_SPORTS.includes(s as Sport);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const sportParam = searchParams.get("sport");
  const sportFilter = isSupportedSport(sportParam) ? sportParam : undefined;

  if (!q) {
    return NextResponse.json({ results: [] as SearchResult[] });
  }

  const sportsToSearch = sportFilter ? [sportFilter] : SUPPORTED_SPORTS;

  // Teams + leagues in parallel; allSettled so a single upstream failure
  // doesn't blank the whole result set.
  const [teamsSettled, ...leaguesSettled] = await Promise.allSettled([
    searchTeams(q),
    ...sportsToSearch.map((s) => searchAllLeagues(s)),
  ]);

  // --- Teams: keep only teams whose sport is one of our four ---
  const teamResults: SearchResult[] =
    teamsSettled?.status === "fulfilled"
      ? teamsSettled.value
          .filter((t): t is typeof t & { sport: Sport } => Boolean(t.sport))
          .filter((t) => (sportFilter ? t.sport === sportFilter : true))
          .map((t) => ({
            type: "team",
            externalId: t.id,
            displayName: t.name,
            sport: t.sport,
          }))
      : [];

  // --- Leagues: substring match on the league name ---
  const leagueResults: SearchResult[] = [];
  for (let i = 0; i < leaguesSettled.length; i++) {
    const settled = leaguesSettled[i]!;
    if (settled.status !== "fulfilled") continue;
    for (const lg of settled.value) {
      if (!lg.name.toLowerCase().includes(q.toLowerCase())) continue;
      const containerSubstring = CONTAINER_LEAGUE_NAME_CONTAINS[lg.name];
      leagueResults.push({
        type: "league",
        externalId: lg.id,
        displayName: lg.name,
        sport: lg.sport,
        ...(containerSubstring
          ? { metadata: { leagueNameContains: containerSubstring } }
          : {}),
      });
    }
  }

  // --- Events: hand-curated catalog ---
  const eventResults: SearchResult[] = searchEventsCatalog(q, sportFilter).map(
    (e) => ({
      type: "event",
      externalId: e.id,
      displayName: e.name,
      sport: e.sport,
      metadata: { startDate: e.startDate, endDate: e.endDate },
    }),
  );

  // --- Sport-as-favorite: matches when the query is part of a sport name ---
  const sportResults: SearchResult[] = SUPPORTED_SPORTS.filter(
    (s) =>
      s.toLowerCase().includes(q.toLowerCase()) &&
      (!sportFilter || s === sportFilter),
  ).map((s) => ({
    type: "sport",
    externalId: s,
    displayName: `${s} (top matches)`,
    sport: s,
  }));

  // Cap each section so the result list stays scannable on a phone.
  const cap = (xs: SearchResult[]) => xs.slice(0, 10);
  const results: SearchResult[] = [
    ...cap(sportResults),
    ...cap(eventResults),
    ...cap(leagueResults),
    ...cap(teamResults),
  ];

  return NextResponse.json({ results });
}
