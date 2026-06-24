/**
 * GET /api/favorites/search?q=...&sport=...
 *
 * Powers the typeahead on the Favorites screen. Substring-matches the
 * query against (a) the committed ESPN team/league catalog
 * (`lib/espn/catalog.json`), (b) the hand-curated events catalog
 * (`lib/events-catalog.ts`), and (c) the supported-sport names. All four
 * sources combine into a single type-labeled result list.
 *
 * Each result is `{ type, externalId, displayName, sport, metadata? }` —
 * exactly the shape POST /api/favorites accepts. The client sends a result
 * back unchanged via FavoriteAddButton.
 *
 * Auth-gated. No upstream network calls (the catalog is committed), so
 * `Promise.allSettled` isn't needed — the search is deterministic and
 * cache-free.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { searchCatalogLeagues, searchCatalogTeams } from "@/lib/espn/catalog";
import { searchEventsCatalog } from "@/lib/events-catalog";
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
  /** Team crest URL when the catalog has one (teams only). */
  badgeUrl?: string;
  metadata?: {
    startDate?: string;
    endDate?: string;
    leagueNameContains?: string;
  };
}

const PER_CATEGORY_CAP = 10;

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

  // --- Leagues: in-memory ESPN catalog ---
  const leagueResults: SearchResult[] = searchCatalogLeagues(
    q,
    sportFilter,
  ).map((l) => ({
    type: "league",
    externalId: l.id,
    displayName: l.name,
    sport: l.sport,
  }));

  // --- Teams: in-memory ESPN catalog. A team can appear in multiple
  // leagues (e.g. Arsenal is in both Premier League and FA Cup catalogs);
  // dedupe by team id so the UI doesn't repeat the same card. ---
  const seenTeamIds = new Set<string>();
  const teamResults: SearchResult[] = [];
  for (const t of searchCatalogTeams(q, sportFilter)) {
    if (!t.sport) continue;
    if (seenTeamIds.has(t.id)) continue;
    seenTeamIds.add(t.id);
    teamResults.push({
      type: "team",
      externalId: t.id,
      displayName: t.name,
      sport: t.sport,
      ...(t.badgeUrl ? { badgeUrl: t.badgeUrl } : {}),
    });
  }

  // Cap each section so the result list stays scannable on a phone.
  const cap = (xs: SearchResult[]) => xs.slice(0, PER_CATEGORY_CAP);
  const results: SearchResult[] = [
    ...cap(sportResults),
    ...cap(eventResults),
    ...cap(leagueResults),
    ...cap(teamResults),
  ];

  return NextResponse.json({ results });
}
