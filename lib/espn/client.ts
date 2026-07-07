/**
 * Typed wrapper around ESPN's unofficial public sports API.
 *
 * SERVER-ONLY. Importing this module from a client component is unsupported
 * because (a) browser CORS may block calls from arbitrary origins and (b)
 * we never want to expose request volume or fingerprintable headers from
 * the user's browser. `app/api/**` Route Handlers proxy these calls.
 *
 * Hot-path endpoints (site v2 — single round-trip, mirrors ESPN's own
 * scoreboard widgets):
 *   - GET /sports/{sport}/{league}/scoreboard?dates=YYYYMMDD   per-league day events
 *   - GET /sports/{sport}/{league}/teams                       per-league team roster
 *   - GET /sports/{sport}/{league}/teams/{teamId}/schedule     per-team schedule
 *
 * Fallback endpoint (sports.core — HATEOAS `$ref` resolver, used only when
 * a field is missing on a site v2 event):
 *   - GET <event-$ref-url>
 *
 * Docs: https://github.com/pseudo-r/Public-ESPN-API
 */

import type {
  League,
  Match,
  MatchStatus,
  Sport,
  Team,
} from "@/lib/sports/types";
import { findSupportedLeague } from "@/lib/espn/leagues";
import type { EntityMatch } from "@/lib/teams/types";

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const CORE_BASE = "https://sports.core.api.espn.com/v2/sports";
const WEB_SEARCH_BASE = "https://site.web.api.espn.com/apis/common/v3/search";

/* -------------------------------------------------------------------------- */
/* Sport <-> URL segment mapping                                              */
/* -------------------------------------------------------------------------- */

/**
 * ESPN's URL `{sport}` segment to our internal `Sport`. Add new sports
 * here when expanding coverage. Tennis was added in Spec 05; its API
 * shape is per-tournament rather than per-league but the segment still
 * resolves through this map for keys like `tennis/atp/wimbledon`.
 */
const SPORT_FROM_SEGMENT: Record<string, Sport> = {
  football: "American Football",
  basketball: "Basketball",
  soccer: "Soccer",
  baseball: "Baseball",
  tennis: "Tennis",
};

/**
 * Returns the internal `Sport` for the `{sport}` segment of an ESPN
 * league key (e.g. `"soccer"` from `"soccer/eng.1"`). Returns `null` for
 * unsupported sports so callers can filter.
 */
export function sportFromLeagueKey(leagueKey: string): Sport | null {
  const [segment] = leagueKey.split("/");
  if (!segment) return null;
  return SPORT_FROM_SEGMENT[segment] ?? null;
}

/* -------------------------------------------------------------------------- */
/* URL builders (pure — exported for tests)                                   */
/* -------------------------------------------------------------------------- */

/** ESPN scoreboard expects `YYYYMMDD` (no hyphens). */
function compactDate(yyyyMmDd: string): string {
  return yyyyMmDd.replaceAll("-", "");
}

export function buildScoreboardUrl(leagueKey: string, date: string): string {
  return `${SITE_BASE}/${leagueKey}/scoreboard?dates=${compactDate(date)}`;
}

export function buildLeagueTeamsUrl(leagueKey: string): string {
  // ESPN paginates teams at 25/page for some leagues. `limit=1000` keeps
  // the response a single call for the leagues we ship.
  return `${SITE_BASE}/${leagueKey}/teams?limit=1000`;
}

export function buildTeamScheduleUrl(
  leagueKey: string,
  teamId: string,
): string {
  return `${SITE_BASE}/${leagueKey}/teams/${encodeURIComponent(teamId)}/schedule`;
}

/* -------------------------------------------------------------------------- */
/* Raw response shapes (subset of fields we actually use)                     */
/* -------------------------------------------------------------------------- */

interface RawCompetitorTeam {
  id: string;
  displayName?: string;
  shortDisplayName?: string;
  logo?: string;
  logos?: { href?: string }[];
}

interface RawCompetitor {
  homeAway?: "home" | "away";
  score?: string;
  team?: RawCompetitorTeam;
}

interface RawBroadcast {
  names?: string[];
}

interface RawVenue {
  fullName?: string;
}

interface RawCompetition {
  date?: string;
  venue?: RawVenue;
  competitors?: RawCompetitor[];
  broadcasts?: RawBroadcast[];
  status?: RawStatus;
}

interface RawStatusType {
  state?: "pre" | "in" | "post";
  shortDetail?: string;
  detail?: string;
  description?: string;
  completed?: boolean;
}

interface RawStatus {
  type?: RawStatusType;
}

interface RawEventLeague {
  id?: string;
  name?: string;
  abbreviation?: string;
  slug?: string;
}

interface RawSeasonType {
  name?: string;
}

interface RawEvent {
  id: string;
  date?: string;
  shortName?: string;
  name?: string;
  status?: RawStatus;
  competitions?: RawCompetition[];
  league?: RawEventLeague;
  season?: { type?: RawSeasonType };
  week?: { number?: number; text?: string };
}

interface RawScoreboardLeague {
  id?: string;
  name?: string;
  abbreviation?: string;
  slug?: string;
}

interface RawScoreboardResponse {
  events?: RawEvent[] | null;
  leagues?: RawScoreboardLeague[] | null;
}

interface RawTeamsTeam {
  id: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logos?: { href?: string }[];
}

interface RawTeamsLeague {
  id?: string;
  name?: string;
  abbreviation?: string;
  slug?: string;
  teams?: { team: RawTeamsTeam }[];
}

interface RawTeamsSport {
  id?: string;
  name?: string;
  slug?: string;
  leagues?: RawTeamsLeague[];
}

interface RawTeamsResponse {
  sports?: RawTeamsSport[] | null;
}

/* -------------------------------------------------------------------------- */
/* Parsers (pure — exported for tests)                                        */
/* -------------------------------------------------------------------------- */

function mapStatus(state: RawStatusType["state"] | undefined): MatchStatus {
  if (state === "in") return "live";
  if (state === "post") return "final";
  return "upcoming";
}

function parseScore(raw: string | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function pickLeagueMeta(
  raw: RawEvent,
  fallbackLeagueKey: string,
  fallbackLeagueName: string,
): { leagueId: string; leagueName: string } {
  // Prefer the league key we requested (canonical for our routing); fall
  // back to whatever ESPN returned on the event for display purposes.
  const leagueName =
    raw.league?.name ?? raw.league?.abbreviation ?? fallbackLeagueName;
  return { leagueId: fallbackLeagueKey, leagueName };
}

/**
 * Maps an ESPN site-v2 scoreboard event to our internal `Match` shape.
 * Returns `null` if the event is missing structurally required fields
 * (home/away competitor, kickoff date, status state) — better to drop a
 * malformed event than to surface a half-populated card.
 *
 * `leagueKey` is the ESPN `{sport}/{league}` key we requested; it
 * populates the canonical `leagueId` and determines `sport`.
 */
export function parseEvent(
  raw: RawEvent,
  leagueKey: string,
  fallbackLeagueName = "",
): Match | null {
  const sport = sportFromLeagueKey(leagueKey);
  if (!sport) return null;

  const competition = raw.competitions?.[0];
  if (!competition) return null;

  const competitors = competition.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team?.id || !away?.team?.id) return null;

  const kickoffUtc = raw.date ?? competition.date ?? null;
  const dateUtc = kickoffUtc ? kickoffUtc.slice(0, 10) : "";
  if (!dateUtc) return null;

  const statusType = (competition.status ?? raw.status)?.type;
  const status = mapStatus(statusType?.state);

  const broadcast = competition.broadcasts
    ?.flatMap((b) => b.names ?? [])
    .filter(Boolean)
    .join(", ");

  const { leagueId, leagueName } = pickLeagueMeta(
    raw,
    leagueKey,
    fallbackLeagueName,
  );

  const homeLogo = home.team.logo ?? home.team.logos?.[0]?.href;
  const awayLogo = away.team.logo ?? away.team.logos?.[0]?.href;

  return {
    id: raw.id,
    sport,
    homeTeamId: home.team.id,
    homeTeamName:
      home.team.displayName ?? home.team.shortDisplayName ?? home.team.id,
    homeTeamShortName: home.team.shortDisplayName,
    homeTeamLogo: homeLogo,
    awayTeamId: away.team.id,
    awayTeamName:
      away.team.displayName ?? away.team.shortDisplayName ?? away.team.id,
    awayTeamShortName: away.team.shortDisplayName,
    awayTeamLogo: awayLogo,
    leagueId,
    leagueName,
    dateUtc,
    kickoffUtc,
    round:
      raw.week?.text ??
      (raw.week?.number ? `Week ${raw.week.number}` : undefined),
    venue: competition.venue?.fullName,
    broadcast: broadcast && broadcast.length > 0 ? broadcast : undefined,
    status,
    homeScore: status === "upcoming" ? undefined : parseScore(home.score),
    awayScore: status === "upcoming" ? undefined : parseScore(away.score),
    liveProgress: status === "live" ? statusType?.shortDetail : undefined,
  };
}

export function parseTeam(raw: RawTeamsTeam, sport: Sport): Team {
  return {
    id: raw.id,
    name: raw.displayName ?? raw.shortDisplayName ?? raw.id,
    sport,
    badgeUrl: raw.logos?.[0]?.href,
  };
}

export function parseLeagueFromScoreboard(
  raw: RawScoreboardLeague,
  leagueKey: string,
): League | null {
  const sport = sportFromLeagueKey(leagueKey);
  if (!sport) return null;
  return {
    id: leagueKey,
    name: raw.name ?? raw.abbreviation ?? leagueKey,
    sport,
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP layer                                                                 */
/* -------------------------------------------------------------------------- */

type FetchFn = typeof fetch;

interface ClientOptions {
  /** Override fetch (for tests). Defaults to global fetch. */
  fetchFn?: FetchFn;
  /** Optional per-call signal for cancellation. */
  signal?: AbortSignal;
}

async function fetchJson<T>(url: string, opts: ClientOptions = {}): Promise<T> {
  const f = opts.fetchFn ?? fetch;
  const res = await f(url, { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Public endpoint functions                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns all events for a given league on a given UTC date. `leagueKey`
 * is the ESPN `{sport}/{league}` key (e.g. `"soccer/eng.1"`). `date` is
 * `YYYY-MM-DD`.
 */
export async function scoreboardForLeague(
  leagueKey: string,
  date: string,
  opts: ClientOptions = {},
): Promise<Match[]> {
  const url = buildScoreboardUrl(leagueKey, date);
  const data = await fetchJson<RawScoreboardResponse>(url, opts);
  if (!data.events) return [];
  const fallbackLeagueName =
    data.leagues?.[0]?.name ?? data.leagues?.[0]?.abbreviation ?? "";
  return data.events
    .map((e) => parseEvent(e, leagueKey, fallbackLeagueName))
    .filter((m): m is Match => m !== null);
}

/**
 * Returns the team roster for a league as our internal `Team` shape.
 * Used by `scripts/refresh-espn-catalog.ts`.
 */
export async function leagueTeams(
  leagueKey: string,
  opts: ClientOptions = {},
): Promise<Team[]> {
  const url = buildLeagueTeamsUrl(leagueKey);
  const data = await fetchJson<RawTeamsResponse>(url, opts);
  const sport = sportFromLeagueKey(leagueKey);
  if (!sport) return [];
  const entries = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return entries.map((e) => parseTeam(e.team, sport));
}

export interface AthleteSearchResult {
  id: string;
  displayName: string;
  /** Our internal sport (mapped from ESPN's `{sport}` segment). */
  sport: Sport;
  /** ESPN `{sport}/{league}` key (e.g. `basketball/nba`, `tennis/wta`). */
  leagueKey: string;
}

/**
 * Searches athletes by name across ESPN's global player index.
 *
 * NOTE: the per-league site-v2 `/athletes?search=` endpoint returns 404, so
 * this uses the working global search — `site.web.api.espn.com/apis/common/v3/
 * search?query=&type=player` — which returns `items[]` of
 * `{ id, sport, league, displayName }`. We keep only players whose `{sport}`
 * segment maps to a supported sport (dropping MMA/olympics/etc.), returning
 * each athlete's actual `leagueKey` so the Teams route can query the right
 * league. Returns `[]` on any fetch/parse error.
 */
export async function searchAthletes(
  q: string,
  opts: ClientOptions = {},
): Promise<AthleteSearchResult[]> {
  try {
    const url = `${WEB_SEARCH_BASE}?query=${encodeURIComponent(q)}&limit=50&type=player`;
    const data = await fetchJson<{
      items?:
        | {
            id?: string | number;
            sport?: string;
            league?: string | null;
            displayName?: string;
          }[]
        | null;
    }>(url, opts);
    const items = data.items ?? [];
    const out: AthleteSearchResult[] = [];
    for (const it of items) {
      if (it.id == null || !it.displayName || !it.sport || !it.league) continue;
      const sport = SPORT_FROM_SEGMENT[it.sport];
      if (!sport) continue; // drop unsupported sports (mma, olympics, …)
      out.push({
        id: String(it.id),
        displayName: it.displayName,
        sport,
        leagueKey: `${it.sport}/${it.league}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

interface CoreEventLogResponse {
  events?: {
    items?: {
      event?: { $ref?: string };
      teamId?: string;
      played?: boolean;
    }[];
  } | null;
}

interface CoreEvent {
  date?: string;
  name?: string;
  competitions?: {
    competitors?: { id?: string; homeAway?: "home" | "away" }[];
  }[];
}

/**
 * Derives the opponent name for a core event relative to the followed
 * athlete's `teamId`. ESPN core event `name`s are formatted "{Away} at
 * {Home}"; we split on that and pick the side the athlete is NOT on, using
 * the inline competitor `homeAway` matched by `teamId` (no extra fetch).
 */
function opponentFromCoreEvent(ev: CoreEvent, teamId: string): string {
  const name = (ev.name ?? "").trim();
  const sep = name.includes(" at ")
    ? " at "
    : name.includes(" vs ")
      ? " vs "
      : null;
  if (!sep) return name;
  const [away, home] = name.split(sep).map((s) => s.trim());
  const mine = ev.competitions?.[0]?.competitors?.find((c) => c.id === teamId);
  if (mine?.homeAway === "home") return away ?? "";
  if (mine?.homeAway === "away") return home ?? "";
  return home ?? away ?? "";
}

function coreEventToEntityMatch(
  ev: CoreEvent,
  teamId: string,
  leagueName: string,
): EntityMatch | null {
  if (!ev.date) return null;
  return {
    opponentName: opponentFromCoreEvent(ev, teamId) || "Opponent",
    date: ev.date.slice(0, 10),
    kickoffUtc: ev.date,
    leagueName,
  };
}

/**
 * Returns an athlete's most-recent completed and next upcoming match.
 *
 * SPIKE FINDINGS (Task 4.1): the site-v2 `athletes/{id}/eventlog` and
 * `athletes?search=` endpoints both 404. The working source is the core API:
 *   GET {CORE_BASE}/{sport}/leagues/{league}/athletes/{id}/eventlog
 * which returns `events.items[]`, each with `{ event: {$ref}, teamId,
 * played }` — but NO inline date/opponent/score. Items are season-ordered,
 * so the last `played:true` item is the most recent match and the first
 * `played:false` item is the next. Resolving each item's `event.$ref` yields
 * inline `date` and `name` ("{Away} at {Home}"), from which we derive the
 * opponent. Scores live behind further `$ref` hops (competitor → score), so
 * they are intentionally omitted here — a best-effort date+opponent for v1.
 * Individual sports (e.g. Tennis) have a different eventlog shape and fall
 * through to the graceful `{ null, null }` outcome. Any fetch/parse error
 * anywhere returns `{ lastMatch: null, nextMatch: null }` — never throws.
 */
export async function athleteSchedule(
  leagueKey: string,
  athleteId: string,
  opts: ClientOptions = {},
): Promise<{ lastMatch: EntityMatch | null; nextMatch: EntityMatch | null }> {
  const empty = { lastMatch: null, nextMatch: null };
  try {
    const [sportPath, leaguePath] = leagueKey.split("/");
    if (!sportPath || !leaguePath) return empty;
    const leagueName = findSupportedLeague(leagueKey)?.displayName ?? leagueKey;
    const url = `${CORE_BASE}/${sportPath}/leagues/${leaguePath}/athletes/${encodeURIComponent(
      athleteId,
    )}/eventlog?limit=50&lang=en&region=us`;
    const log = await fetchJson<CoreEventLogResponse>(url, opts);
    const items = log.events?.items ?? [];
    if (items.length === 0) return empty;

    const played = items.filter((i) => i.played && i.event?.$ref);
    const upcoming = items.filter((i) => i.played === false && i.event?.$ref);
    const lastItem = played[played.length - 1];
    const nextItem = upcoming[0];

    const resolve = async (
      item: (typeof items)[number] | undefined,
    ): Promise<EntityMatch | null> => {
      const ref = item?.event?.$ref;
      if (!ref) return null;
      // Core `$ref`s come back as http:// — upgrade to https to avoid a redirect.
      const ev = await fetchJson<CoreEvent>(
        ref.replace(/^http:/, "https:"),
        opts,
      );
      return coreEventToEntityMatch(ev, item?.teamId ?? "", leagueName);
    };

    const [lastMatch, nextMatch] = await Promise.all([
      resolve(lastItem),
      resolve(nextItem),
    ]);
    return { lastMatch, nextMatch };
  } catch {
    return empty;
  }
}

/**
 * Returns the schedule for a single team in a league. ESPN returns up to
 * the next ~25 events; we map them into our `Match` shape with the
 * provided `leagueKey` as the canonical `leagueId`.
 */
export async function teamScheduleForLeague(
  leagueKey: string,
  teamId: string,
  opts: ClientOptions = {},
): Promise<Match[]> {
  const url = buildTeamScheduleUrl(leagueKey, teamId);
  const data = await fetchJson<{ events?: RawEvent[] | null }>(url, opts);
  if (!data.events) return [];
  return data.events
    .map((e) => parseEvent(e, leagueKey))
    .filter((m): m is Match => m !== null);
}

/**
 * Opt-in fallback into `sports.core.api.espn.com` to resolve a `$ref`
 * URL. Used only when a needed field (e.g. `venue`) is missing on a
 * site-v2 event. Not invoked in the homepage hot path.
 *
 * Returns the raw JSON; callers know the shape they expect.
 */
export async function fetchEventCoreDetail<T>(
  refUrl: string,
  opts: ClientOptions = {},
): Promise<T> {
  if (!/^https:\/\/sports\.core\.api\.espn\.com\//.test(refUrl)) {
    throw new Error(`Refusing non-core $ref url: ${refUrl}`);
  }
  return fetchJson<T>(refUrl, opts);
}
