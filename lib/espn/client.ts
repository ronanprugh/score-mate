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
  TennisSetScore,
} from "@/lib/sports/types";
import { findSupportedLeague } from "@/lib/espn/leagues";
import { MATCH_HISTORY_CAP } from "@/lib/teams/schedule";
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
  /**
   * When set, hints Next.js to cache this GET response for N seconds (its
   * `fetch` data cache). Used by the athlete-schedule fan-out to keep the
   * per-competition resolution from re-hitting ESPN on every 60s poll.
   */
  revalidateSeconds?: number;
}

async function fetchJson<T>(url: string, opts: ClientOptions = {}): Promise<T> {
  const f = opts.fetchFn ?? fetch;
  const init: RequestInit & { next?: { revalidate: number } } = {
    signal: opts.signal,
  };
  if (opts.revalidateSeconds !== undefined) {
    init.next = { revalidate: opts.revalidateSeconds };
  }
  const res = await f(url, init);
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
      /** Points at the athlete's SPECIFIC match (used for individual sports). */
      competition?: { $ref?: string };
      /** Present for team sports only; absent for tennis and other 1-v-1s. */
      teamId?: string;
    }[];
  } | null;
}

/** Set-by-set scores, either inline or behind a `$ref`. */
type CoreLinescores = { $ref?: string } | { value?: number }[] | undefined;

interface CoreCompetitor {
  id?: string;
  name?: string;
  homeAway?: "home" | "away";
  winner?: boolean;
  linescores?: CoreLinescores;
  /** Team-sport final score, when the core API returns it inline. */
  score?: string;
}

interface CoreEvent {
  date?: string;
  name?: string;
  competitions?: { competitors?: CoreCompetitor[] }[];
}

interface CoreCompetition {
  date?: string;
  competitors?: CoreCompetitor[];
  /** Draw/event type, e.g. "Men's Singles" — mirrors the site-v2 tennis shape. */
  type?: { text?: string };
  round?: { displayName?: string };
  venue?: { court?: string };
}

/**
 * Splits a core event's `name` ("{Away} at {Home}" or "{Away} vs {Home}")
 * into its two sides. Returns `null` when the name doesn't match either
 * separator (better to omit than guess).
 */
function splitEventName(ev: CoreEvent): { away: string; home: string } | null {
  const name = (ev.name ?? "").trim();
  const sep = name.includes(" at ")
    ? " at "
    : name.includes(" vs ")
      ? " vs "
      : null;
  if (!sep) return null;
  const [away, home] = name.split(sep).map((s) => s.trim());
  if (!away || !home) return null;
  return { away, home };
}

/**
 * Derives the opponent name for a team-sport core event relative to the
 * followed athlete's `teamId`, using the inline competitor `homeAway`
 * matched by `teamId`.
 */
function opponentFromCoreEvent(ev: CoreEvent, teamId: string): string {
  const split = splitEventName(ev);
  if (!split) return (ev.name ?? "").trim();
  const mine = ev.competitions?.[0]?.competitors?.find((c) => c.id === teamId);
  if (mine?.homeAway === "home") return split.away;
  if (mine?.homeAway === "away") return split.home;
  return split.home || split.away;
}

/** A match resolved from the eventlog, before we pick last/next. */
interface ResolvedMatch {
  /** ISO timestamp. */
  date: string;
  opponentName: string;
  /** True once a result is decided. */
  completed: boolean;
  /** Whether the followed entity won; `undefined` when the outcome is unknown. */
  won?: boolean;
  /** Lazily resolves the formatted score (may need another fetch). */
  scoreFetcher: () => Promise<string | undefined>;
}

/** Resolves a competitor's set-by-set linescores into a games-per-set array. */
async function resolveLinescoreValues(
  ls: CoreLinescores,
  opts: ClientOptions,
): Promise<number[]> {
  if (!ls) return [];
  if (Array.isArray(ls)) return ls.map((x) => x.value ?? 0);
  if (ls.$ref) {
    const data = await fetchJson<{ items?: { value?: number }[] }>(
      ls.$ref.replace(/^http:/, "https:"),
      opts,
    );
    return (data.items ?? []).map((x) => x.value ?? 0);
  }
  return [];
}

/** Resolves both competitors' set scores into "7-5, 6-4" (athlete first). */
async function tennisSetScore(
  mine: CoreCompetitor | undefined,
  opp: CoreCompetitor | undefined,
  opts: ClientOptions,
): Promise<string | undefined> {
  const [m, o] = await Promise.all([
    resolveLinescoreValues(mine?.linescores, opts),
    resolveLinescoreValues(opp?.linescores, opts),
  ]);
  if (m.length === 0 || o.length === 0) return undefined;
  return m.map((v, i) => `${v}-${o[i] ?? 0}`).join(", ");
}

/**
 * Returns an athlete's most-recent completed and next upcoming match.
 *
 * SPIKE FINDINGS (Task 4.1 + follow-ups): the site-v2 `athletes/{id}/eventlog`
 * and `athletes?search=` endpoints 404. The working source is the core API
 * `.../athletes/{id}/eventlog`, whose `events.items[]` carry a `competition`
 * (individual sports) or `event` + `teamId` (team sports) `$ref` — but NO
 * inline date, and the list is NOT chronological (nor is the `played` flag
 * reliable). So we resolve every item, then pick by date: the latest completed
 * match and the earliest upcoming one.
 *
 * Two eventlog shapes:
 *   - TEAM sports carry `teamId`; the resolved event `name` is "{Away} at
 *     {Home}", from which we derive the opponent.
 *   - INDIVIDUAL sports (tennis) have no `teamId`; the event is the whole
 *     tournament, so we resolve the athlete's specific `competition` and read
 *     the opposing competitor's `name` and set scores directly.
 *
 * Responses are cached (`revalidateSeconds`) so the per-competition fan-out
 * doesn't re-hit ESPN on every poll. Any fetch/parse error returns
 * `{ lastMatch: null, nextMatch: null }` — never throws.
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
    // Completed results never change and start times rarely do, so cache the
    // whole fan-out for 5 min unless the caller overrides.
    const req: ClientOptions = {
      ...opts,
      revalidateSeconds: opts.revalidateSeconds ?? 300,
    };
    const https = (ref: string) => ref.replace(/^http:/, "https:");

    const url = `${CORE_BASE}/${sportPath}/leagues/${leaguePath}/athletes/${encodeURIComponent(
      athleteId,
    )}/eventlog?limit=300&lang=en&region=us`;
    const log = await fetchJson<CoreEventLogResponse>(url, req);
    const items = log.events?.items ?? [];
    if (items.length === 0) return empty;

    const now = Date.now();

    const resolveItem = async (
      item: (typeof items)[number],
    ): Promise<ResolvedMatch | null> => {
      // Team sports: single game; opponent from the event name.
      if (item.teamId && item.event?.$ref) {
        const ev = await fetchJson<CoreEvent>(https(item.event.$ref), req);
        if (!ev.date) return null;
        const mine = ev.competitions?.[0]?.competitors?.find(
          (c) => c.id === item.teamId,
        );
        return {
          date: ev.date,
          opponentName: opponentFromCoreEvent(ev, item.teamId) || "Opponent",
          completed: Date.parse(ev.date) < now,
          won: mine?.winner,
          scoreFetcher: async () => undefined,
        };
      }
      // Individual sports (tennis): the athlete's specific match.
      if (item.competition?.$ref) {
        const comp = await fetchJson<CoreCompetition>(
          https(item.competition.$ref),
          req,
        );
        if (!comp.date) return null;
        const competitors = comp.competitors ?? [];
        const idPrefix = (c: CoreCompetitor) => (c.id ?? "").split("-")[0];
        const mine = competitors.find((c) => idPrefix(c) === athleteId);
        const opp = competitors.find((c) => idPrefix(c) !== athleteId);
        return {
          date: comp.date,
          opponentName: opp?.name?.trim() || "Opponent",
          completed: competitors.some((c) => c.winner === true),
          won: mine?.winner,
          scoreFetcher: () => tennisSetScore(mine, opp, req),
        };
      }
      return null;
    };

    const resolved = (await Promise.all(items.map(resolveItem))).filter(
      (r): r is ResolvedMatch => r !== null,
    );

    const byDate = (a: ResolvedMatch, b: ResolvedMatch) =>
      a.date.localeCompare(b.date);
    const completed = resolved.filter((r) => r.completed).sort(byDate);
    const upcoming = resolved
      .filter((r) => !r.completed && Date.parse(r.date) >= now)
      .sort(byDate);

    const lastR = completed[completed.length - 1];
    const nextR = upcoming[0];

    const toMatch = async (
      r: ResolvedMatch | undefined,
      withScore: boolean,
    ): Promise<EntityMatch | null> => {
      if (!r) return null;
      const match: EntityMatch = {
        opponentName: r.opponentName,
        date: r.date.slice(0, 10),
        kickoffUtc: r.date,
        leagueName,
      };
      if (withScore) {
        const score = await r.scoreFetcher();
        if (score) match.score = score;
        if (r.won !== undefined) match.result = r.won ? "W" : "L";
      }
      return match;
    };

    const [lastMatch, nextMatch] = await Promise.all([
      toMatch(lastR, true),
      toMatch(nextR, false),
    ]);
    return { lastMatch, nextMatch };
  } catch {
    return empty;
  }
}

/** A player match resolved from the eventlog, before capping + deep-resolve. */
interface ResolvedPlayerMatch {
  date: string;
  completed: boolean;
  /** Builds the full `Match` for this item. May trigger further fetches
   * (e.g. tennis linescores) — only called for the capped set. */
  build: () => Promise<Match | null>;
}

function playerMatchStatus(dateIso: string, completed: boolean): MatchStatus {
  return completed || Date.parse(dateIso) < Date.now() ? "final" : "upcoming";
}

/**
 * Returns up to `MATCH_HISTORY_CAP` recent (completed, most-recent-first)
 * and `MATCH_HISTORY_CAP` upcoming (soonest-first) matches for an athlete,
 * as fully-populated `Match` objects — unlike `athleteSchedule`, which
 * reduces to a single last/next `EntityMatch` summary. Powers the entity
 * match-detail screen (Spec 11) so a followed player's history renders with
 * the same `MatchCard` / `TennisMatchCard` components as Home.
 *
 * Two-phase resolution to bound fan-out: phase 1 resolves every eventlog
 * item's `event`/`competition` $ref (unavoidable — the eventlog carries no
 * inline date) to get date + identity, then sorts and caps to
 * `MATCH_HISTORY_CAP` per side; phase 2 only fetches the additional,
 * per-match detail needed for full fidelity (tennis set-by-set linescores)
 * for that capped set — never for the full eventlog.
 *
 * Never throws — returns `{ recent: [], upcoming: [] }` on any failure, same
 * as `athleteSchedule`.
 */
export async function athleteMatchHistory(
  leagueKey: string,
  athleteId: string,
  opts: ClientOptions = {},
): Promise<{ recent: Match[]; upcoming: Match[] }> {
  const empty = { recent: [], upcoming: [] };
  try {
    const sport = sportFromLeagueKey(leagueKey);
    if (!sport) return empty;
    const leagueName = findSupportedLeague(leagueKey)?.displayName ?? leagueKey;
    const req: ClientOptions = {
      ...opts,
      revalidateSeconds: opts.revalidateSeconds ?? 300,
    };
    const https = (ref: string) => ref.replace(/^http:/, "https:");

    const url = `${CORE_BASE}/${leagueKey}/athletes/${encodeURIComponent(
      athleteId,
    )}/eventlog?limit=300&lang=en&region=us`;
    const log = await fetchJson<CoreEventLogResponse>(url, req);
    const items = log.events?.items ?? [];
    if (items.length === 0) return empty;

    const resolveItem = async (
      item: (typeof items)[number],
    ): Promise<ResolvedPlayerMatch | null> => {
      // Team sports: resolve the shared event once; build() is cheap (no
      // further fetches — score/team info is already inline).
      if (item.teamId && item.event?.$ref) {
        const ev = await fetchJson<CoreEvent>(https(item.event.$ref), req);
        if (!ev.date) return null;
        const competitors = ev.competitions?.[0]?.competitors ?? [];
        const mine = competitors.find((c) => c.id === item.teamId);
        const opp = competitors.find((c) => c.id !== item.teamId);
        const completed =
          mine?.winner !== undefined || opp?.winner !== undefined;
        return {
          date: ev.date,
          completed,
          build: async (): Promise<Match | null> => {
            const split = splitEventName(ev);
            const status = playerMatchStatus(ev.date!, completed);
            const homeIsMine = mine?.homeAway === "home";
            const homeName = split
              ? split.home
              : (homeIsMine ? mine : opp)?.name || "Home";
            const awayName = split
              ? split.away
              : (homeIsMine ? opp : mine)?.name || "Away";
            const homeCompetitor = homeIsMine ? mine : opp;
            const awayCompetitor = homeIsMine ? opp : mine;
            return {
              id: item.event!.$ref!,
              sport,
              homeTeamId: homeCompetitor?.id ?? "home",
              homeTeamName: homeName,
              awayTeamId: awayCompetitor?.id ?? "away",
              awayTeamName: awayName,
              leagueId: leagueKey,
              leagueName,
              dateUtc: ev.date!.slice(0, 10),
              kickoffUtc: ev.date!,
              status,
              homeScore:
                status === "upcoming"
                  ? undefined
                  : parseScore(homeCompetitor?.score),
              awayScore:
                status === "upcoming"
                  ? undefined
                  : parseScore(awayCompetitor?.score),
            };
          },
        };
      }

      // Individual sports (tennis): resolve the specific competition once
      // for identity/date; build() lazily fetches set scores (the "deep"
      // resolve step) only when this item survives the 10/10 cap.
      if (item.competition?.$ref) {
        const comp = await fetchJson<CoreCompetition>(
          https(item.competition.$ref),
          req,
        );
        if (!comp.date) return null;
        const competitors = comp.competitors ?? [];
        const idPrefix = (c: CoreCompetitor) => (c.id ?? "").split("-")[0];
        const mine = competitors.find((c) => idPrefix(c) === athleteId);
        const opp = competitors.find((c) => idPrefix(c) !== athleteId);
        const completed = competitors.some((c) => c.winner === true);
        return {
          date: comp.date,
          completed,
          build: async (): Promise<Match | null> => {
            const status = playerMatchStatus(comp.date!, completed);
            const [mineValues, oppValues] = await Promise.all([
              resolveLinescoreValues(mine?.linescores, req),
              resolveLinescoreValues(opp?.linescores, req),
            ]);
            const numSets = Math.max(mineValues.length, oppValues.length);
            const buildSets = (
              own: number[],
              other: number[],
            ): TennisSetScore[] =>
              Array.from({ length: numSets }, (_, i) => ({
                games: own[i] ?? 0,
                won: (own[i] ?? 0) > (other[i] ?? 0),
              }));
            return {
              id: item.competition!.$ref!,
              sport: "Tennis",
              homeTeamId: mine?.id ?? "home",
              homeTeamName: mine?.name ?? "Player",
              awayTeamId: opp?.id ?? "away",
              awayTeamName: opp?.name ?? "Opponent",
              leagueId: leagueKey,
              leagueName,
              dateUtc: comp.date!.slice(0, 10),
              kickoffUtc: comp.date!,
              status,
              round: comp.round?.displayName,
              tennis: {
                draw: comp.type?.text,
                round: comp.round?.displayName,
                court: comp.venue?.court,
                home: {
                  sets: buildSets(mineValues, oppValues),
                  won: mine?.winner === true,
                },
                away: {
                  sets: buildSets(oppValues, mineValues),
                  won: opp?.winner === true,
                },
              },
            };
          },
        };
      }

      return null;
    };

    const resolved = (await Promise.all(items.map(resolveItem))).filter(
      (r): r is ResolvedPlayerMatch => r !== null,
    );

    const byDateAsc = (a: ResolvedPlayerMatch, b: ResolvedPlayerMatch) =>
      a.date.localeCompare(b.date);
    const now = Date.now();

    const completedCapped = resolved
      .filter((r) => r.completed)
      .sort((a, b) => byDateAsc(b, a)) // most-recent-first
      .slice(0, MATCH_HISTORY_CAP);
    const upcomingCapped = resolved
      .filter((r) => !r.completed && Date.parse(r.date) >= now)
      .sort(byDateAsc) // soonest-first
      .slice(0, MATCH_HISTORY_CAP);

    const [recent, upcoming] = await Promise.all([
      Promise.all(completedCapped.map((r) => r.build())),
      Promise.all(upcomingCapped.map((r) => r.build())),
    ]);

    return {
      recent: recent.filter((m): m is Match => m !== null),
      upcoming: upcoming.filter((m): m is Match => m !== null),
    };
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
