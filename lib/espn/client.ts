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
  season?: number,
): string {
  const base = `${SITE_BASE}/${leagueKey}/teams/${encodeURIComponent(teamId)}/schedule`;
  return season === undefined ? base : `${base}?season=${season}`;
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

/**
 * A competitor score. The scoreboard endpoint sends a string; the per-team
 * schedule endpoint sends an object. Both are normalized by `parseScore`.
 */
type RawScore = string | number | { value?: number; displayValue?: string };

interface RawCompetitor {
  homeAway?: "home" | "away";
  score?: RawScore;
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

/**
 * Normalizes a competitor score across the two shapes ESPN uses.
 *
 * The scoreboard endpoint returns a plain string (`"2"`). The per-team
 * schedule endpoint returns an object (`{ value: 2, displayValue: "2" }`).
 * Handling only the string silently produced `Number({…})` → `NaN` →
 * `undefined`, so every completed match sourced from a team schedule lost its
 * score. Found while recording Spec 13's fixtures; see `13-task-01-proofs.md`.
 */
function parseScore(raw: RawScore | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "object") {
    if (typeof raw.value === "number" && Number.isFinite(raw.value)) {
      return raw.value;
    }
    return parseScore(raw.displayValue);
  }
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

interface AthleteMatchHistoryOptions extends ClientOptions {
  /**
   * Matches to resolve per side. Defaults to `MATCH_HISTORY_CAP` (the detail
   * screen's page size); the Teams list passes 1, since it renders only a
   * last/next pair.
   *
   * This is not cosmetic — the cap bounds phase 2, and for tennis each
   * surviving match costs two more linescore fetches. Asking for 10 to use 1
   * would spend ~20 upstream requests per followed player per cache miss.
   */
  cap?: number;
}

/**
 * Returns up to `cap` recent (completed, most-recent-first) and `cap` upcoming
 * (soonest-first) matches for an athlete, as fully-populated `Match` objects.
 * Powers the Teams list and the entity match-detail screen so a followed
 * player's history renders with the same `MatchCard` / `TennisMatchCard`
 * components as Home.
 *
 * Two-phase resolution to bound fan-out: phase 1 resolves every eventlog
 * item's `event`/`competition` $ref (unavoidable — the eventlog carries no
 * inline date) to get date + identity, then sorts and caps to `cap` per side;
 * phase 2 only fetches the additional, per-match detail needed for full
 * fidelity (tennis set-by-set linescores) for that capped set — never for the
 * full eventlog.
 *
 * Never throws — returns `{ recent: [], upcoming: [] }` on any failure, so a
 * player ESPN has no data on degrades to "Match data unavailable".
 */
export async function athleteMatchHistory(
  leagueKey: string,
  athleteId: string,
  opts: AthleteMatchHistoryOptions = {},
): Promise<{ recent: Match[]; upcoming: Match[] }> {
  const empty = { recent: [], upcoming: [] };
  const { cap = MATCH_HISTORY_CAP, ...fetchOpts } = opts;
  try {
    const sport = sportFromLeagueKey(leagueKey);
    if (!sport) return empty;
    const leagueName = findSupportedLeague(leagueKey)?.displayName ?? leagueKey;
    const req: ClientOptions = {
      ...fetchOpts,
      revalidateSeconds: fetchOpts.revalidateSeconds ?? 300,
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
      .slice(0, cap);
    const upcomingCapped = resolved
      .filter((r) => !r.completed && Date.parse(r.date) >= now)
      .sort(byDateAsc) // soonest-first
      .slice(0, cap);

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
 * The season year to ask ESPN for, given a clock.
 *
 * ESPN's season year is the season's *starting* year: `season=2025` returns
 * the 2025-26 campaign. Sports disagree about when a season rolls over (the
 * NFL in February, MLB in November, European soccer in June), and ESPN
 * registers the next season at an unpredictable point — often before any
 * fixtures exist for it.
 *
 * Rather than encode a per-sport calendar that would silently rot, we ask for
 * the current calendar year and let `teamScheduleForLeague`'s empty-result
 * fallback handle the rollover window. See Spec 13 Technical Considerations.
 */
export function currentEspnSeasonYear(now: Date = new Date()): number {
  return now.getUTCFullYear();
}

interface TeamScheduleOptions extends ClientOptions {
  /**
   * Pin an explicit season instead of deriving one from the clock. Pinning
   * also disables the previous-season fallback — the caller has said which
   * season it wants.
   */
  season?: number;
}

/** One season's worth of a team's schedule, parsed into `Match` objects. */
async function fetchSeasonSchedule(
  leagueKey: string,
  teamId: string,
  season: number,
  opts: ClientOptions,
): Promise<Match[]> {
  const url = buildTeamScheduleUrl(leagueKey, teamId, season);
  const data = await fetchJson<{ events?: RawEvent[] | null }>(url, opts);
  if (!data.events) return [];
  // ESPN populates `event.league` on this endpoint, but pass our own display
  // name as the fallback anyway: without it a missing `league` yields
  // `leagueName: ""`, which reads as a card with no competition at all.
  const fallbackLeagueName =
    findSupportedLeague(leagueKey)?.displayName ?? leagueKey;
  return data.events
    .map((e) => parseEvent(e, leagueKey, fallbackLeagueName))
    .filter((m): m is Match => m !== null);
}

/**
 * Returns the schedule for a single team in a league, as `Match` objects with
 * `leagueKey` as the canonical `leagueId`.
 *
 * Sends an explicit `season`, because ESPN's implicit default resolves to the
 * *upcoming* season as soon as one is registered — and an unpublished season
 * returns `events: []`, not an error. Left unhandled, that renders a followed
 * team as "Match data unavailable" for the whole offseason even though a full
 * completed season sits one parameter away (Spec 13, Unit 1).
 *
 * Reaches back to `currentYear - 1` and merges when the current season carries
 * no completed matches. Testing only for `length === 0` is not enough: ESPN
 * registers a handful of next-season fixtures well before the in-progress
 * season ends, and any one of them makes the current-season response non-empty
 * — which would hide an entire season of results behind a single future
 * friendly. "No results yet" is the honest signal that the current season has
 * not started, and it holds in the empty case too.
 *
 * Merging rather than replacing means the rollover window shows last season's
 * finale as "Last" alongside the new season's opener as "Next", instead of
 * flipping between the two. Exactly one extra request — a team genuinely
 * without fixtures must not walk backwards through seasons — and none at all
 * once the current season has a result. Two empty seasons resolve to `[]`
 * rather than throwing, preserving the graceful degradation both Teams routes
 * depend on. HTTP failures still throw, so a genuine upstream outage is
 * reported rather than silently read as "no matches".
 */
export async function teamScheduleForLeague(
  leagueKey: string,
  teamId: string,
  opts: TeamScheduleOptions = {},
): Promise<Match[]> {
  const { season, ...fetchOpts } = opts;
  if (season !== undefined) {
    return fetchSeasonSchedule(leagueKey, teamId, season, fetchOpts);
  }

  const currentSeason = currentEspnSeasonYear();
  const current = await fetchSeasonSchedule(
    leagueKey,
    teamId,
    currentSeason,
    fetchOpts,
  );
  if (current.some((m) => m.status === "final")) return current;

  const previous = await fetchSeasonSchedule(
    leagueKey,
    teamId,
    currentSeason - 1,
    fetchOpts,
  );
  if (previous.length === 0) return current;

  // Dedupe: a fixture straddling the rollover can be listed under both.
  const byId = new Map(previous.map((m) => [m.id, m]));
  for (const m of current) byId.set(m.id, m);
  return [...byId.values()];
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
