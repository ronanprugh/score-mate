/**
 * Server-side homepage aggregator.
 *
 * Given a user's id, the client-computed [yesterday, today, tomorrow] LOCAL
 * window, and the user's IANA timezone, this:
 *   1. reads the user's favorites,
 *   2. computes the union of supported ESPN league keys touched by those
 *      favorites (any favorite carrying a `sport` expands to every league
 *      in that sport via `leagueKeysForSport`; favorited league keys and
 *      event-catalog league keys are unioned in too),
 *   3. fans out one `eventsLeagueDay(leagueKey, date)` call per (key, date)
 *      across a widened 5-date UTC window (yesterday-1 … tomorrow+1) to
 *      handle the timezone-bucket problem,
 *   4. runs them all in parallel via Promise.allSettled,
 *   5. feeds the union of results through `matchFavoritesAgainstMatches`,
 *   6. partitions by LOCAL date (computed from `kickoffUtc` + user TZ —
 *      NOT by the UTC `dateUtc` field), sorts each day by kickoff,
 *      deduplicates by match id, and
 *   7. returns a typed envelope including a `source.errors` array if any
 *      upstream calls rejected.
 *
 * The fetcher is dependency-injected so tests can run without touching
 * the network and the route handler can swap in a cache-wrapped version.
 *
 * (Pre-ESPN: this module also took per-team and per-league fetchers to
 * work around TheSportsDB's lossy per-sport-day endpoint. ESPN's per-league
 * scoreboard returns every game in the league for the date, so the per-team
 * and per-league fan-outs are gone — every game we care about is already in
 * the per-(league, date) result set.)
 */

import type { DateWindow } from "@/lib/date-window";
import {
  enrichMatchWithEventInstance,
  findEventInstanceById,
} from "@/lib/events-catalog";
import { leagueKeysForSport } from "@/lib/espn/leagues";
import { matchFavoritesAgainstMatches } from "@/lib/favorite-matcher";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import type { Match, Sport } from "@/lib/sports/types";
import type { FavoriteRow } from "@/db/schema/favorites";
import type { ActiveTournament } from "./tennis-aggregator";

/** Fetches every match for a league on a single UTC date. */
export type EventsLeagueDayFetcher = (
  leagueKey: string,
  date: string,
) => Promise<Match[]>;

export interface Fetchers {
  eventsLeagueDay: EventsLeagueDayFetcher;
  activeTennisTournaments: (today: string) => Promise<ActiveTournament[]>;
}

export interface HomeEnvelope {
  yesterday: Match[];
  today: Match[];
  tomorrow: Match[];
  activeTennisTournaments: ActiveTournament[];
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
  activeTennisTournaments: [],
  source: { ok: true, errors: [] },
});

const LATE_KICKOFF_SENTINEL = "9999-12-31T23:59:59";

function sortByKickoff(a: Match, b: Match): number {
  const ak = a.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
  const bk = b.kickoffUtc ?? LATE_KICKOFF_SENTINEL;
  return ak.localeCompare(bk);
}

/**
 * Returns the sort key for a tournament card in the mixed today feed.
 * Uses the minimum `kickoffUtc` across live or upcoming matches.
 * Falls back to `LATE_KICKOFF_SENTINEL` when no live/upcoming matches
 * exist, placing the tournament below all match cards.
 */
export function sortKeyForTournamentCard(t: ActiveTournament): string {
  const liveOrUpcoming = t.matches.filter(
    (m) => m.status === "live" || m.status === "upcoming",
  );
  if (liveOrUpcoming.length === 0) return LATE_KICKOFF_SENTINEL;
  return liveOrUpcoming
    .map((m) => m.kickoffUtc ?? LATE_KICKOFF_SENTINEL)
    .reduce((a, b) => (a < b ? a : b));
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
 * is a UTC date that may differ from the user's local date for
 * late-night/early-morning matches). Falls back to `dateUtc` when
 * `kickoffUtc` is null.
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
  activeTennisTournaments: ActiveTournament[] = [],
): HomeEnvelope {
  const enriched = matches.map(enrichMatchWithEventInstance);
  const matched = matchFavoritesAgainstMatches(favorites, enriched);

  const out: HomeEnvelope = {
    yesterday: [],
    today: [],
    tomorrow: [],
    activeTennisTournaments,
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
 * Computes the set of ESPN league keys we need to fan out across, given
 * the user's favorites. Exposed (not just used internally) so the cache
 * layer and tests can reason about the planned call set without invoking
 * the network.
 *
 * The result is the union of:
 *   (a) every supported league key for each sport that any favorite touches,
 *   (b) any favorited league's `externalId` (already a leagueKey for ESPN),
 *   (c) the `leagueId` of any event-catalog entry referenced by an Event
 *       favorite.
 *
 * (b) and (c) are usually subsumed by (a) — they only widen the set when
 * a favorite somehow references a league key outside `SUPPORTED_LEAGUES`.
 */
export function planLeagueKeys(favorites: readonly FavoriteRow[]): string[] {
  const sports = new Set<Sport>(favorites.map((f) => f.sport));
  const keys = new Set<string>();
  for (const sport of sports) {
    for (const key of leagueKeysForSport(sport)) keys.add(key);
  }
  for (const f of favorites) {
    if (f.type === "league") {
      keys.add(f.externalId);
    } else if (f.type === "event") {
      const catalogEntry = findEventInstanceById(f.externalId);
      if (catalogEntry?.leagueId) keys.add(catalogEntry.leagueId);
    }
  }
  return Array.from(keys);
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
  const leagueKeys = planLeagueKeys(favorites);
  if (leagueKeys.length === 0) return EMPTY_ENVELOPE();

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

  // ---- Schedule -------------------------------------------------------
  const leagueCalls: Promise<Match[]>[] = [];
  for (const leagueKey of leagueKeys) {
    for (const date of dateList) {
      leagueCalls.push(fetchers.eventsLeagueDay(leagueKey, date));
    }
  }

  const [leagueSettled, tennisSettled] = await Promise.all([
    Promise.allSettled(leagueCalls),
    Promise.allSettled([fetchers.activeTennisTournaments(dates.today)]),
  ]);

  const errors: string[] = [];
  const allMatches: Match[] = [];

  for (const s of leagueSettled) {
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

  let activeTennisTournaments: ActiveTournament[] = [];
  const ts = tennisSettled[0]!;
  if (ts.status === "fulfilled") {
    activeTennisTournaments = ts.value;
  } else {
    const reason = ts.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unknown upstream error";
    errors.push(message);
  }

  return buildHomeEnvelope(
    favorites,
    allMatches,
    dates,
    errors,
    tz,
    activeTennisTournaments,
  );
}
