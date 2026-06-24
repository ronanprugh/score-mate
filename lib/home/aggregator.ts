/**
 * Server-side homepage aggregator.
 *
 * Given a user's id and a client-computed [yesterday, today, tomorrow]
 * window, this:
 *   1. reads the user's favorites,
 *   2. plans the union of TheSportsDB queries we need:
 *        a. one `eventsDay` per (date × sport) covered by any favorite —
 *           a wide net that catches anything the source associates with
 *           the right sport bucket on that date.
 *        b. one `eventsTeam(teamId)` per favorited team — TheSportsDB's
 *           per-team next/last endpoints sometimes surface matches that
 *           `eventsDay` doesn't.
 *        c. one `eventsLeague(leagueId)` per favorited league OR per Event
 *           favorite whose catalog entry maps to a stable `leagueId` —
 *           closes the gap where a league's matches don't appear under the
 *           sport's `eventsDay` (notably tennis tour aggregators and
 *           league containers that share an `idLeague` across instances).
 *   3. runs them all in parallel via Promise.allSettled,
 *   4. feeds the union of results through `matchFavoritesAgainstMatches`,
 *   5. partitions by date, sorts each day by kickoff, deduplicates by
 *      match id, and
 *   6. returns a typed envelope including a `source.errors` array if any
 *      upstream calls rejected.
 *
 * All fetchers are dependency-injected so tests can run without touching
 * the network and the route handler can swap in cache-wrapped versions.
 */

import type { DateWindow } from "@/lib/date-window";
import {
  enrichMatchWithEventInstance,
  findEventInstanceById,
} from "@/lib/events-catalog";
import { matchFavoritesAgainstMatches } from "@/lib/favorite-matcher";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import type { Match, Sport } from "@/lib/sportsdb/types";
import type { FavoriteRow } from "@/db/schema/favorites";

export type EventsDayFetcher = (date: string, sport: Sport) => Promise<Match[]>;
export type EventsTeamFetcher = (teamId: string) => Promise<Match[]>;
export type EventsLeagueFetcher = (leagueId: string) => Promise<Match[]>;

export interface Fetchers {
  eventsDay: EventsDayFetcher;
  /** Returns both upcoming and recent matches for a team (next + last). */
  eventsTeam: EventsTeamFetcher;
  /** Returns both upcoming and recent matches for a league (next + past). */
  eventsLeague: EventsLeagueFetcher;
}

export interface HomeEnvelope {
  yesterday: Match[];
  today: Match[];
  tomorrow: Match[];
  source: {
    /** True if every upstream call succeeded. */
    ok: boolean;
    /** Human-readable error strings for each rejected call. */
    errors: string[];
  };
}

const EMPTY_ENVELOPE = (): HomeEnvelope => ({
  yesterday: [],
  today: [],
  tomorrow: [],
  source: { ok: true, errors: [] },
});

function sortByKickoff(a: Match, b: Match): number {
  const ak = a.kickoffUtc ?? "9999-12-31T23:59:59";
  const bk = b.kickoffUtc ?? "9999-12-31T23:59:59";
  return ak.localeCompare(bk);
}

/**
 * Pure (no DB, no fetch) variant that takes already-loaded favorites and
 * an already-loaded match list. Used by the route handler test and by
 * the public function below.
 */
export function buildHomeEnvelope(
  favorites: readonly FavoriteRow[],
  matches: readonly Match[],
  dates: DateWindow,
  errors: string[] = [],
): HomeEnvelope {
  // Tag matches with `eventInstanceId` from the curated events catalog
  // before running the matcher. Without this, type='event' favorites can
  // never match anything because TheSportsDB itself never sets the id.
  const enriched = matches.map(enrichMatchWithEventInstance);
  const matched = matchFavoritesAgainstMatches(favorites, enriched);

  const out: HomeEnvelope = {
    yesterday: [],
    today: [],
    tomorrow: [],
    source: { ok: errors.length === 0, errors },
  };

  for (const m of matched) {
    if (m.dateUtc === dates.yesterday) out.yesterday.push(m);
    else if (m.dateUtc === dates.today) out.today.push(m);
    else if (m.dateUtc === dates.tomorrow) out.tomorrow.push(m);
    // Otherwise: the match is outside the window. Ignore.
  }

  out.yesterday.sort(sortByKickoff);
  out.today.sort(sortByKickoff);
  out.tomorrow.sort(sortByKickoff);

  return out;
}

/**
 * Full pipeline: load favorites, plan + run queries, build the envelope.
 */
export async function aggregateMatchesForUser(
  userId: string,
  dates: DateWindow,
  fetchers: Fetchers,
): Promise<HomeEnvelope> {
  const favorites = await listFavoritesForUser(userId);
  if (favorites.length === 0) return EMPTY_ENVELOPE();

  // ---- Plan -----------------------------------------------------------
  const sportsNeeded = Array.from(
    new Set(favorites.map((f) => f.sport)),
  ) as Sport[];
  const dateList = [dates.yesterday, dates.today, dates.tomorrow] as const;

  const teamIds = new Set<string>();
  const leagueIds = new Set<string>();
  for (const f of favorites) {
    if (f.type === "team") {
      teamIds.add(f.externalId);
    } else if (f.type === "league") {
      leagueIds.add(f.externalId);
    } else if (f.type === "event") {
      const catalogEntry = findEventInstanceById(f.externalId);
      if (catalogEntry?.leagueId) leagueIds.add(catalogEntry.leagueId);
    }
  }

  // ---- Schedule -------------------------------------------------------
  const calls: Promise<Match[]>[] = [];

  // (a) Per-sport day fetches
  for (const sport of sportsNeeded) {
    for (const date of dateList) {
      calls.push(fetchers.eventsDay(date, sport));
    }
  }
  // (b) Per-team fetches
  for (const teamId of teamIds) {
    calls.push(fetchers.eventsTeam(teamId));
  }
  // (c) Per-league fetches
  for (const leagueId of leagueIds) {
    calls.push(fetchers.eventsLeague(leagueId));
  }

  const settled = await Promise.allSettled(calls);
  const errors: string[] = [];
  const allMatches: Match[] = [];

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]!;
    if (s.status === "fulfilled") {
      allMatches.push(...s.value);
    } else {
      const reason = s.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unknown upstream error";
      errors.push(message);
    }
  }

  return buildHomeEnvelope(favorites, allMatches, dates, errors);
}
