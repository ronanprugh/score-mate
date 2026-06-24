/**
 * Server-side homepage aggregator.
 *
 * Given a user's id and a client-computed [yesterday, today, tomorrow]
 * window, this:
 *   1. reads the user's favorites,
 *   2. plans the minimum set of TheSportsDB queries (one eventsDay per
 *      (date × sport) covered by any favorite),
 *   3. runs them in parallel via Promise.allSettled,
 *   4. feeds the union of results through `matchFavoritesAgainstMatches`,
 *   5. partitions by date, sorts each day by kickoff, deduplicates by
 *      match id, and
 *   6. returns a typed envelope including a `source.errors` array if any
 *      upstream calls rejected.
 *
 * The `eventsDay` fetcher is dependency-injected so tests can run without
 * touching the network and the route handler can swap in the
 * cache-wrapped version.
 */

import type { DateWindow } from "@/lib/date-window";
import { enrichMatchWithEventInstance } from "@/lib/events-catalog";
import { matchFavoritesAgainstMatches } from "@/lib/favorite-matcher";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import type { Match, Sport } from "@/lib/sportsdb/types";
import type { FavoriteRow } from "@/db/schema/favorites";

export type EventsDayFetcher = (date: string, sport: Sport) => Promise<Match[]>;

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
  fetcher: EventsDayFetcher,
): Promise<HomeEnvelope> {
  const favorites = await listFavoritesForUser(userId);
  if (favorites.length === 0) return EMPTY_ENVELOPE();

  // Plan: unique sports across all favorites × three dates.
  const sportsNeeded = Array.from(
    new Set(favorites.map((f) => f.sport)),
  ) as Sport[];
  const dateList = [dates.yesterday, dates.today, dates.tomorrow] as const;

  const calls: Array<
    Promise<{ date: string; sport: Sport; matches: Match[] }>
  > = [];
  for (const sport of sportsNeeded) {
    for (const date of dateList) {
      calls.push(
        fetcher(date, sport).then((matches) => ({ date, sport, matches })),
      );
    }
  }

  const settled = await Promise.allSettled(calls);
  const errors: string[] = [];
  const allMatches: Match[] = [];

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]!;
    if (s.status === "fulfilled") {
      allMatches.push(...s.value.matches);
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
