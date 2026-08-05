import { teamScheduleForLeague } from "@/lib/espn/client";
import { companionLeagueKeys } from "@/lib/espn/leagues";
import type { Match } from "@/lib/sports/types";

/** Matches per side shown on the entity detail screen (Spec 11). */
export const MATCH_HISTORY_CAP = 10;

/** Options forwarded to each per-league schedule request. */
export interface CompetitionFanoutOptions {
  /** Override fetch (for tests). */
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  revalidateSeconds?: number;
  /**
   * Wraps each per-league lookup, so route handlers can apply their own
   * caching (`unstable_cache`) per league without this module importing
   * Next.js internals. Defaults to calling `teamScheduleForLeague` directly.
   */
  fetchLeagueSchedule?: (leagueKey: string, teamId: string) => Promise<Match[]>;
}

/**
 * A followed team's matches across every competition they play, not just their
 * primary domestic league.
 *
 * ESPN's site-v2 API has no "all competitions for this team" endpoint —
 * `/teams/{id}/schedule` is per league key — so the fan-out happens here, over
 * the static `COMPANION_LEAGUE_KEYS` map. A Premier League team therefore
 * resolves league, both domestic cups, the three UEFA competitions, and
 * friendlies (Spec 13, Unit 2).
 *
 * Requests run concurrently and settle independently: a competition the team
 * does not compete in simply returns nothing, and a competition that *fails*
 * contributes an error string without suppressing the rest. Only genuine
 * failures land in `errors` — "not in this cup" is not an error, and must not
 * flip the envelope's `source.ok`.
 */
export async function teamScheduleAcrossCompetitions(
  primaryLeagueKey: string,
  teamId: string,
  opts: CompetitionFanoutOptions = {},
): Promise<{ matches: Match[]; errors: string[] }> {
  const { fetchLeagueSchedule, ...fetchOpts } = opts;
  const fetchOne =
    fetchLeagueSchedule ??
    ((leagueKey: string, id: string) =>
      teamScheduleForLeague(leagueKey, id, fetchOpts));

  const leagueKeys = [
    primaryLeagueKey,
    ...companionLeagueKeys(primaryLeagueKey),
  ];

  const settled = await Promise.allSettled(
    leagueKeys.map((leagueKey) => fetchOne(leagueKey, teamId)),
  );

  const errors: string[] = [];
  // Dedupe by ESPN match id: the same fixture can surface under more than one
  // league key (a cup tie listed by both organiser and domestic league).
  const byId = new Map<string, Match>();

  settled.forEach((result, i) => {
    if (result.status === "rejected") {
      const reason = result.reason;
      errors.push(
        `Schedule fetch failed for ${leagueKeys[i]}: ${
          reason instanceof Error ? reason.message : String(reason)
        }`,
      );
      return;
    }
    for (const match of result.value) {
      if (!byId.has(match.id)) byId.set(match.id, match);
    }
  });

  return { matches: [...byId.values()], errors };
}

/** Sort key shared by every selector here, so they cannot drift apart. */
function sortKey(m: Match): string {
  return m.kickoffUtc ?? `${m.dateUtc}T00:00:00Z`;
}

/**
 * The most recent completed match and the soonest upcoming one, across
 * whatever competitions are present.
 *
 * No preference for competitive fixtures over friendlies — in preseason the
 * friendly *is* the news, and a fan asking "when did they last play" means it
 * literally (Spec 13, Unit 2).
 */
export function selectLastAndNext(matches: readonly Match[]): {
  lastMatch: Match | null;
  nextMatch: Match | null;
} {
  let lastMatch: Match | null = null;
  let nextMatch: Match | null = null;

  for (const m of matches) {
    if (m.status === "final") {
      if (!lastMatch || sortKey(m) > sortKey(lastMatch)) lastMatch = m;
    } else if (m.status === "upcoming") {
      if (!nextMatch || sortKey(m) < sortKey(nextMatch)) nextMatch = m;
    }
  }

  return { lastMatch, nextMatch };
}

/**
 * Splits a schedule into the `MATCH_HISTORY_CAP` most recent completed
 * matches (most-recent first) and the `MATCH_HISTORY_CAP` soonest upcoming
 * matches (soonest first). Shares `sortKey` with `selectLastAndNext` so the
 * two selectors cannot drift apart.
 */
export function splitAndCapSchedule(matches: readonly Match[]): {
  recent: Match[];
  upcoming: Match[];
} {
  const recent = matches
    .filter((m) => m.status === "final")
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    .slice(0, MATCH_HISTORY_CAP);
  const upcoming = matches
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .slice(0, MATCH_HISTORY_CAP);

  return { recent, upcoming };
}
