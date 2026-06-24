/**
 * Typed wrapper around TheSportsDB's free-tier endpoints.
 *
 * SERVER-ONLY. Importing this module from a client component is unsupported
 * because (a) it would expose calls to the upstream API to browser CORS
 * (TheSportsDB doesn't set permissive CORS headers for all endpoints) and
 * (b) it would put us in a worse position if we ever rotate to a paid key.
 * `app/api/**` Route Handlers proxy these calls instead.
 *
 * Endpoints used:
 *   - GET /eventsday.php?d=YYYY-MM-DD&s=<Sport>     events on a date for a sport
 *   - GET /eventsnext.php?id=<teamId>               next 5 events for a team
 *   - GET /eventslast.php?id=<teamId>               last 5 events for a team
 *   - GET /eventsnextleague.php?id=<leagueId>       next ~15 events in a league
 *   - GET /eventspastleague.php?id=<leagueId>       last ~15 events in a league
 *   - GET /searchteams.php?t=<name>                 team search by name
 *   - GET /search_all_leagues.php?s=<Sport>         league discovery by sport
 *
 * Docs: https://www.thesportsdb.com/free_sports_api
 */

import type { League, Match, MatchStatus, Sport, Team } from "./types";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

/* -------------------------------------------------------------------------- */
/* URL builders (pure — exported for tests)                                   */
/* -------------------------------------------------------------------------- */

export function buildEventsDayUrl(date: string, sport: Sport): string {
  const params = new URLSearchParams({ d: date, s: sport });
  return `${BASE_URL}/eventsday.php?${params.toString()}`;
}

export function buildEventsNextUrl(teamId: string): string {
  return `${BASE_URL}/eventsnext.php?id=${encodeURIComponent(teamId)}`;
}

export function buildEventsLastUrl(teamId: string): string {
  return `${BASE_URL}/eventslast.php?id=${encodeURIComponent(teamId)}`;
}

export function buildEventsNextLeagueUrl(leagueId: string): string {
  return `${BASE_URL}/eventsnextleague.php?id=${encodeURIComponent(leagueId)}`;
}

export function buildEventsPastLeagueUrl(leagueId: string): string {
  return `${BASE_URL}/eventspastleague.php?id=${encodeURIComponent(leagueId)}`;
}

export function buildSearchTeamsUrl(query: string): string {
  return `${BASE_URL}/searchteams.php?t=${encodeURIComponent(query)}`;
}

export function buildSearchAllLeaguesUrl(sport: Sport): string {
  return `${BASE_URL}/search_all_leagues.php?s=${encodeURIComponent(sport)}`;
}

/* -------------------------------------------------------------------------- */
/* Raw response shapes (subset of fields we actually use)                     */
/* -------------------------------------------------------------------------- */

interface RawEvent {
  idEvent: string;
  idLeague: string;
  strLeague: string;
  strSport: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string;
  strTime: string | null;
  strTimestamp: string | null;
  strRound: string | null;
  strVenue: string | null;
  strTVStation: string | null;
  strStatus: string | null;
  strProgress: string | null;
}

interface RawTeam {
  idTeam: string;
  strTeam: string;
  strSport: string;
  strLeague: string;
  idLeague: string;
  strTeamBadge: string | null;
}

interface RawLeague {
  idLeague: string;
  strLeague: string;
  strSport: string;
}

/* -------------------------------------------------------------------------- */
/* Parsers (pure — exported for tests)                                        */
/* -------------------------------------------------------------------------- */

const SPORT_NAME_MAP: Record<string, Sport> = {
  Soccer: "Soccer",
  "American Football": "American Football",
  Basketball: "Basketball",
  Tennis: "Tennis",
};

function normalizeSport(raw: string): Sport | null {
  return SPORT_NAME_MAP[raw] ?? null;
}

function parseStatus(strStatus: string | null): MatchStatus {
  if (!strStatus) return "upcoming";
  const s = strStatus.toLowerCase();
  if (
    s.includes("finished") ||
    s.includes("final") ||
    s.includes("ft") ||
    s.includes("aet") ||
    s.includes("ap") // after penalties
  ) {
    return "final";
  }
  if (
    s.includes("in play") ||
    s.includes("in progress") ||
    s.includes("live")
  ) {
    return "live";
  }
  return "upcoming";
}

function parseScore(raw: string | null): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseEvent(raw: RawEvent): Match | null {
  const sport = normalizeSport(raw.strSport);
  if (!sport) return null;

  const status = parseStatus(raw.strStatus);
  return {
    id: raw.idEvent,
    sport,
    homeTeamId: raw.idHomeTeam,
    homeTeamName: raw.strHomeTeam,
    awayTeamId: raw.idAwayTeam,
    awayTeamName: raw.strAwayTeam,
    leagueId: raw.idLeague,
    leagueName: raw.strLeague,
    dateUtc: raw.dateEvent,
    kickoffUtc: raw.strTimestamp ?? null,
    round: raw.strRound ?? undefined,
    venue: raw.strVenue ?? undefined,
    broadcast: raw.strTVStation ?? undefined,
    status,
    homeScore: status === "upcoming" ? undefined : parseScore(raw.intHomeScore),
    awayScore: status === "upcoming" ? undefined : parseScore(raw.intAwayScore),
    liveProgress:
      status === "live" ? (raw.strProgress ?? undefined) : undefined,
  };
}

export function parseTeam(raw: RawTeam): Team {
  return {
    id: raw.idTeam,
    name: raw.strTeam,
    sport: normalizeSport(raw.strSport) ?? undefined,
    badgeUrl: raw.strTeamBadge ?? undefined,
  };
}

export function parseLeague(raw: RawLeague): League | null {
  const sport = normalizeSport(raw.strSport);
  if (!sport) return null;
  return { id: raw.idLeague, name: raw.strLeague, sport };
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
    throw new Error(`TheSportsDB ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Public endpoint functions                                                  */
/* -------------------------------------------------------------------------- */

export async function eventsDay(
  date: string,
  sport: Sport,
  opts: ClientOptions = {},
): Promise<Match[]> {
  const url = buildEventsDayUrl(date, sport);
  const data = await fetchJson<{ events: RawEvent[] | null }>(url, opts);
  if (!data.events) return [];
  return data.events.map(parseEvent).filter((m): m is Match => m !== null);
}

export async function eventsNext(
  teamId: string,
  opts: ClientOptions = {},
): Promise<Match[]> {
  const url = buildEventsNextUrl(teamId);
  const data = await fetchJson<{ events: RawEvent[] | null }>(url, opts);
  if (!data.events) return [];
  return data.events.map(parseEvent).filter((m): m is Match => m !== null);
}

export async function eventsLast(
  teamId: string,
  opts: ClientOptions = {},
): Promise<Match[]> {
  const url = buildEventsLastUrl(teamId);
  const data = await fetchJson<{ results: RawEvent[] | null }>(url, opts);
  if (!data.results) return [];
  return data.results.map(parseEvent).filter((m): m is Match => m !== null);
}

export async function eventsNextLeague(
  leagueId: string,
  opts: ClientOptions = {},
): Promise<Match[]> {
  const url = buildEventsNextLeagueUrl(leagueId);
  const data = await fetchJson<{ events: RawEvent[] | null }>(url, opts);
  if (!data.events) return [];
  return data.events.map(parseEvent).filter((m): m is Match => m !== null);
}

export async function eventsPastLeague(
  leagueId: string,
  opts: ClientOptions = {},
): Promise<Match[]> {
  const url = buildEventsPastLeagueUrl(leagueId);
  const data = await fetchJson<{ events: RawEvent[] | null }>(url, opts);
  if (!data.events) return [];
  return data.events.map(parseEvent).filter((m): m is Match => m !== null);
}

export async function searchTeams(
  query: string,
  opts: ClientOptions = {},
): Promise<Team[]> {
  const url = buildSearchTeamsUrl(query);
  const data = await fetchJson<{ teams: RawTeam[] | null }>(url, opts);
  if (!data.teams) return [];
  return data.teams.map(parseTeam);
}

export async function searchAllLeagues(
  sport: Sport,
  opts: ClientOptions = {},
): Promise<League[]> {
  const url = buildSearchAllLeaguesUrl(sport);
  const data = await fetchJson<{ countries: RawLeague[] | null }>(url, opts);
  if (!data.countries) return [];
  return data.countries.map(parseLeague).filter((l): l is League => l !== null);
}
