import { teamScheduleForLeague } from "@/lib/espn/client";
import { companionLeagueKeys } from "@/lib/espn/leagues";
import type { Match } from "@/lib/sports/types";

/** Matches per side shown on the entity detail screen (Spec 11). */
export const MATCH_HISTORY_CAP = 10;

/**
 * How to fetch one competition's schedule.
 *
 * A union rather than a flat bag of optionals: when a caller supplies its own
 * `fetchLeagueSchedule` (route handlers do, to apply `unstable_cache` per
 * league without this module importing Next.js internals), it owns the whole
 * request — passing `signal` or `revalidateSeconds` alongside it would silently
 * do nothing, so the type forbids it.
 */
export type CompetitionFanoutOptions =
  | {
      fetchLeagueSchedule: (
        leagueKey: string,
        teamId: string,
      ) => Promise<Match[]>;
    }
  | {
      fetchLeagueSchedule?: undefined;
      /** Override fetch (for tests). */
      fetchFn?: typeof fetch;
      signal?: AbortSignal;
      revalidateSeconds?: number;
    };

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
 * contributes a message without suppressing the rest. "Not in this cup" is
 * never an error.
 *
 * Failures are split by how much they cost the user, because this fan-out is
 * wide — 7 competitions per Premier League team, 47 upstream calls across a
 * 7-entity favorites profile — and a single flaky companion call must not
 * light up the data-source banner on an otherwise complete screen:
 *
 *   - `errors` — the primary league failed. The card is probably missing the
 *     fixtures the user actually came for, so this flips `source.ok`.
 *   - `warnings` — a companion competition failed. At worst the user is
 *     missing a cup tie; the primary schedule still rendered. Reported for
 *     diagnostics, but does not flip `source.ok`.
 */
export async function teamScheduleAcrossCompetitions(
  primaryLeagueKey: string,
  teamId: string,
  opts: CompetitionFanoutOptions = {},
): Promise<{ matches: Match[]; errors: string[]; warnings: string[] }> {
  const fetchOne = opts.fetchLeagueSchedule
    ? opts.fetchLeagueSchedule
    : (leagueKey: string, id: string) =>
        teamScheduleForLeague(leagueKey, id, opts);

  const leagueKeys = [
    primaryLeagueKey,
    ...companionLeagueKeys(primaryLeagueKey),
  ];

  const settled = await Promise.allSettled(
    leagueKeys.map((leagueKey) => fetchOne(leagueKey, teamId)),
  );

  const errors: string[] = [];
  const warnings: string[] = [];
  // Dedupe by ESPN match id: the same fixture can surface under more than one
  // league key (a cup tie listed by both organiser and domestic league).
  const byId = new Map<string, Match>();

  settled.forEach((result, i) => {
    if (result.status === "rejected") {
      const reason = result.reason;
      const message = `Schedule fetch failed for ${leagueKeys[i]}: ${
        reason instanceof Error ? reason.message : String(reason)
      }`;
      // Index 0 is always the primary league — see `leagueKeys` above.
      (i === 0 ? errors : warnings).push(message);
      return;
    }
    for (const match of result.value) {
      if (!byId.has(match.id)) byId.set(match.id, match);
    }
  });

  return { matches: [...byId.values()], errors, warnings };
}

/** Sort key shared by every selector here, so they cannot drift apart. */
function sortKey(m: Match): string {
  return m.kickoffUtc ?? `${m.dateUtc}T00:00:00Z`;
}

/**
 * The most recent completed match and the soonest current-or-upcoming one,
 * across whatever competitions are present.
 *
 * No preference for competitive fixtures over friendlies — in preseason the
 * friendly *is* the news, and a fan asking "when did they last play" means it
 * literally (Spec 13, Unit 2).
 *
 * A live match takes the "next" slot rather than being dropped. It is neither
 * final nor upcoming, so filtering on those two statuses alone made a team's
 * in-progress game — the single most interesting thing on the card — the one
 * fixture the Teams list could not show. Its kickoff is already past, so
 * ordering by `sortKey` puts it ahead of any genuinely upcoming fixture.
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
    } else if (!nextMatch || sortKey(m) < sortKey(nextMatch)) {
      nextMatch = m;
    }
  }

  return { lastMatch, nextMatch };
}

/**
 * Splits a schedule into the `MATCH_HISTORY_CAP` most recent completed
 * matches (most-recent first) and the `MATCH_HISTORY_CAP` soonest
 * current-or-upcoming matches (soonest first). Shares `sortKey` and its
 * live-match handling with `selectLastAndNext` so the two selectors cannot
 * drift apart.
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
    .filter((m) => m.status !== "final")
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .slice(0, MATCH_HISTORY_CAP);

  return { recent, upcoming };
}
