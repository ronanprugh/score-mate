/**
 * GET /api/favorites/search?q=...&sport=...
 *
 * Powers the typeahead on the Favorites screen. Substring-matches the
 * query against (a) the committed ESPN team/league catalog
 * (`lib/espn/catalog.json`), (b) the hand-curated events catalog
 * (`lib/events-catalog.ts`), and (c) the supported-sport names, then (d)
 * fans out a live ESPN athlete search (one call per sport) for players.
 * All sources combine into a single type-labeled result list.
 *
 * Each result is `{ type, externalId, displayName, sport, metadata? }` —
 * exactly the shape POST /api/favorites accepts. The client sends a result
 * back unchanged via FavoriteAddButton.
 *
 * Auth-gated. The catalog sources are deterministic and cache-free; the
 * athlete fan-out suppresses its own per-call failures (a failing sport just
 * contributes no players), so a partial upstream outage never fails search.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { searchCatalogLeagues, searchCatalogTeams } from "@/lib/espn/catalog";
import { searchAthletes } from "@/lib/espn/client";
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
    leagueKey?: string;
  };
}

// ESPN's global search already returns marquee players first by relevance, so
// we preserve that order and only DEMOTE college/practice players (whose
// surnames often collide with a star's — e.g. "messi" → college "Messinger").
// Array.sort is stable, so pro players keep ESPN's relevance order.
function leagueRank(leagueKey: string): number {
  return leagueKey.includes("college") ? 1 : 0;
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
  // Tennis catalog entries are stored as leagues (no per-year ids) but must
  // POST as type:"event" so the favorites system can call the tennis scoreboard
  // by year-less tournament id. See Spec 05 Q3 Round 1 (B).
  const leagueResults: SearchResult[] = searchCatalogLeagues(
    q,
    sportFilter,
  ).map((l) => ({
    type: l.sport === "Tennis" ? ("event" as const) : ("league" as const),
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

  // --- Players: one global ESPN athlete search, ranked + deduped ---
  // `searchAthletes` hits ESPN's global player index and suppresses its own
  // errors (returning []). We drop athletes whose sport is filtered out, rank
  // pro leagues above college/minor, dedupe by athlete id, and carry each
  // athlete's real `leagueKey` in metadata so the Teams route can look up the
  // right league schedule.
  const seenAthleteIds = new Set<string>();
  const playerResults: SearchResult[] = (await searchAthletes(q))
    .filter((a) => !sportFilter || a.sport === sportFilter)
    .sort((a, b) => leagueRank(a.leagueKey) - leagueRank(b.leagueKey))
    .filter((a) => {
      if (seenAthleteIds.has(a.id)) return false;
      seenAthleteIds.add(a.id);
      return true;
    })
    .map((a) => ({
      type: "player" as const,
      externalId: a.id,
      displayName: a.displayName,
      sport: a.sport,
      metadata: { leagueKey: a.leagueKey },
    }));

  // Cap each section so the result list stays scannable on a phone.
  const cap = (xs: SearchResult[]) => xs.slice(0, PER_CATEGORY_CAP);
  const results: SearchResult[] = [
    ...cap(sportResults),
    ...cap(eventResults),
    ...cap(leagueResults),
    ...cap(teamResults),
    ...cap(playerResults),
  ];

  return NextResponse.json({ results });
}
