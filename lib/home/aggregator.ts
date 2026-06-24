/**
 * Server-side homepage aggregator.
 *
 * Given a user's id, the client-computed [yesterday, today, tomorrow] LOCAL
 * window, and the user's IANA timezone, this:
 *   1. reads the user's favorites,
 *   2. plans the union of TheSportsDB queries we need:
 *        a. one `eventsDay` per (UTC date × sport). To handle the
 *           timezone-bucket problem (a 9pm-Eastern match has UTC date
 *           "tomorrow" but local date "today"), we widen the UTC fetch
 *           window to FIVE days: yesterday-1 … tomorrow+1.
 *        b. one `eventsTeam(teamId)` per favorited team.
 *        c. one `eventsLeague(leagueId)` per favorited league OR per Event
 *           favorite whose catalog entry maps to a stable `leagueId`.
 *   3. runs them all in parallel via Promise.allSettled,
 *   4. feeds the union of results through `matchFavoritesAgainstMatches`,
 *   5. partitions by LOCAL date (computed from `kickoffUtc` + user TZ —
 *      NOT by the UTC `dateUtc` field), sorts each day by kickoff,
 *      deduplicates by match id, and
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(yyyyMmDd: string, delta: number): string {
  // Treat the input as a UTC midnight; we only care about the date string.
  const t = Date.parse(`${yyyyMmDd}T00:00:00Z`);
  const d = new Date(t + delta * MS_PER_DAY);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the LOCAL `YYYY-MM-DD` string of a match in the given IANA tz.
 * Uses `kickoffUtc` when present (the only reliable signal — `dateUtc`
 * from TheSportsDB is a UTC date that may differ from the user's local
 * date for late-night/early-morning matches). Falls back to `dateUtc`
 * when `kickoffUtc` is null.
 */
export function localDateOfMatch(match: Match, tz: string): string {
  if (!match.kickoffUtc) return match.dateUtc;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(match.kickoffUtc));
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return match.dateUtc;
  }
}

/**
 * Pure (no DB, no fetch) variant that takes already-loaded favorites and
 * an already-loaded match list. Used by the route handler test and by
 * the public function below.
 *
 * `tz` is the user's IANA timezone — required for correct bucketing of
 * matches whose UTC date differs from their local date. Defaults to
 * `"UTC"` for tests / legacy callers.
 */
export function buildHomeEnvelope(
  favorites: readonly FavoriteRow[],
  matches: readonly Match[],
  dates: DateWindow,
  errors: string[] = [],
  tz: string = "UTC",
): HomeEnvelope {
  const enriched = matches.map(enrichMatchWithEventInstance);
  const matched = matchFavoritesAgainstMatches(favorites, enriched);

  const out: HomeEnvelope = {
    yesterday: [],
    today: [],
    tomorrow: [],
    source: { ok: errors.length === 0, errors },
  };

  for (const m of matched) {
    const local = localDateOfMatch(m, tz);
    if (local === dates.yesterday) out.yesterday.push(m);
    else if (local === dates.today) out.today.push(m);
    else if (local === dates.tomorrow) out.tomorrow.push(m);
    // Otherwise: the match is outside the local window. Ignore.
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
  tz: string = "UTC",
): Promise<HomeEnvelope> {
  const favorites = await listFavoritesForUser(userId);
  if (favorites.length === 0) return EMPTY_ENVELOPE();

  // ---- Plan -----------------------------------------------------------
  const sportsNeeded = Array.from(
    new Set(favorites.map((f) => f.sport)),
  ) as Sport[];
  // Widen the UTC fetch window by ±1 day so we catch late-night matches
  // (UTC date = local date + 1) and early-morning matches (UTC date =
  // local date - 1) at the window edges. The bucketing step below
  // reassigns each match to its true local day, dropping anything that
  // falls outside [yesterday, today, tomorrow] in the user's tz.
  const dateList = [
    addDays(dates.yesterday, -1),
    dates.yesterday,
    dates.today,
    dates.tomorrow,
    addDays(dates.tomorrow, 1),
  ] as const;

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

  // (a) Per-sport day fetches (5-date widened UTC window)
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

  return buildHomeEnvelope(favorites, allMatches, dates, errors, tz);
}
