/**
 * Tennis sport: per-tour scoreboard client + marquee tournament registry.
 *
 * Tennis differs from team-sport leagues — ESPN's tennis API is keyed by
 * TOUR (`atp`, `wta`), not by tournament. A single tour-level scoreboard
 * call for a given date returns whichever tournaments are in session
 * that day, with each event's `name` carrying the tournament label
 * ("Wimbledon", "Roland Garros", etc.). Matches live inside
 * `event.groupings[].competitions[]` and competitors are athletes
 * (singles) rather than teams.
 *
 * Per Spec 05 Q1 (D), v1 coverage is the "marquee" set: the four Grand
 * Slams + nine ATP 1000s + ten WTA 1000s = 23 tournaments. The registry
 * therefore acts as a tournament-name allowlist applied to the
 * tour-level scoreboard response, not a per-endpoint URL list.
 *
 * Identifier convention (Spec 05 Q2 Round 2 (B)): `tennis/{tour}/{slug}`
 * with `{tour}` ∈ `atp | wta | slam` and `{slug}` a stable year-less
 * lowercase-hyphen identifier (`wimbledon`, `australian-open`, etc.).
 * The same identifier is used as the favorite `externalId`, so a
 * favorite carries forward across editions automatically.
 *
 * Source URLs for the marquee calendar (verify yearly):
 *   - ATP 2026 calendar:  https://www.atptour.com/en/tournaments
 *   - WTA 2026 calendar:  https://www.wtatennis.com/tournaments
 *
 * Slam entries fan out to both the ATP and WTA tour scoreboards (men's
 * + women's draws). Each ESPN tour endpoint:
 *   https://site.api.espn.com/apis/site/v2/sports/tennis/{atp|wta}/scoreboard?dates=YYYYMMDD
 */

import type {
  Match,
  TennisPlayerLine,
  TennisSetScore,
} from "@/lib/sports/types";

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports";

export type TennisTour = "ATP" | "WTA" | "Slam";

export interface MarqueeTournament {
  /** Stable year-less identifier, e.g. `tennis/slam/wimbledon`. */
  id: string;
  tour: TennisTour;
  displayName: string;
  /**
   * ESPN's `event.name` value for matches in this tournament. Used to
   * filter the tour-level scoreboard response down to just this
   * tournament's events. Case-sensitive exact match.
   */
  espnEventName: string;
  /**
   * Which ESPN tour endpoint(s) to fetch. ATP 1000 = `["atp"]`,
   * WTA 1000 = `["wta"]`, Slam = `["atp", "wta"]` (men's + women's).
   */
  tourEndpoints: readonly ("atp" | "wta")[];
}

function compactDate(yyyyMmDd: string): string {
  return yyyyMmDd.replaceAll("-", "");
}

export function buildTennisTourScoreboardUrl(
  tour: "atp" | "wta",
  date: string,
): string {
  return `${SITE_BASE}/tennis/${tour}/scoreboard?dates=${compactDate(date)}`;
}

export const MARQUEE_TENNIS_TOURNAMENTS: readonly MarqueeTournament[] = [
  // Grand Slams (4)
  {
    id: "tennis/slam/australian-open",
    tour: "Slam",
    displayName: "Australian Open",
    espnEventName: "Australian Open",
    tourEndpoints: ["atp", "wta"],
  },
  {
    id: "tennis/slam/roland-garros",
    tour: "Slam",
    displayName: "Roland Garros",
    espnEventName: "Roland Garros",
    tourEndpoints: ["atp", "wta"],
  },
  {
    id: "tennis/slam/wimbledon",
    tour: "Slam",
    displayName: "Wimbledon",
    espnEventName: "Wimbledon",
    tourEndpoints: ["atp", "wta"],
  },
  {
    id: "tennis/slam/us-open",
    tour: "Slam",
    displayName: "US Open",
    espnEventName: "US Open",
    tourEndpoints: ["atp", "wta"],
  },

  // ATP 1000s (9)
  {
    id: "tennis/atp/indian-wells",
    tour: "ATP",
    displayName: "BNP Paribas Open",
    espnEventName: "BNP Paribas Open",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/miami",
    tour: "ATP",
    displayName: "Miami Open",
    espnEventName: "Miami Open presented by Itau",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/monte-carlo",
    tour: "ATP",
    displayName: "Monte-Carlo Masters",
    espnEventName: "Rolex Monte-Carlo Masters",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/madrid",
    tour: "ATP",
    displayName: "Mutua Madrid Open",
    espnEventName: "Mutua Madrid Open",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/rome",
    tour: "ATP",
    displayName: "Italian Open",
    espnEventName: "Internazionali BNL d'Italia",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/canada",
    tour: "ATP",
    displayName: "Canadian Open",
    espnEventName: "National Bank Open presented by Rogers",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/cincinnati",
    tour: "ATP",
    displayName: "Cincinnati Open",
    espnEventName: "Cincinnati Open",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/shanghai",
    tour: "ATP",
    displayName: "Shanghai Masters",
    espnEventName: "Rolex Shanghai Masters",
    tourEndpoints: ["atp"],
  },
  {
    id: "tennis/atp/paris",
    tour: "ATP",
    displayName: "Rolex Paris Masters",
    espnEventName: "Rolex Paris Masters",
    tourEndpoints: ["atp"],
  },

  // WTA 1000s (10)
  {
    id: "tennis/wta/doha",
    tour: "WTA",
    displayName: "Qatar Open",
    espnEventName: "Qatar Total Energies Open",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/dubai",
    tour: "WTA",
    displayName: "Dubai Tennis Championships",
    espnEventName: "Dubai Duty Free Tennis Championships",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/indian-wells",
    tour: "WTA",
    displayName: "BNP Paribas Open",
    espnEventName: "BNP Paribas Open",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/miami",
    tour: "WTA",
    displayName: "Miami Open",
    espnEventName: "Miami Open presented by Itau",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/madrid",
    tour: "WTA",
    displayName: "Mutua Madrid Open",
    espnEventName: "Mutua Madrid Open",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/rome",
    tour: "WTA",
    displayName: "Italian Open",
    espnEventName: "Internazionali BNL d'Italia",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/canada",
    tour: "WTA",
    displayName: "Canadian Open",
    espnEventName: "National Bank Open presented by Rogers",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/cincinnati",
    tour: "WTA",
    displayName: "Cincinnati Open",
    espnEventName: "Cincinnati Open",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/wuhan",
    tour: "WTA",
    displayName: "Wuhan Open",
    espnEventName: "Dongfeng Voyah Wuhan Open",
    tourEndpoints: ["wta"],
  },
  {
    id: "tennis/wta/beijing",
    tour: "WTA",
    displayName: "China Open",
    espnEventName: "China Open",
    tourEndpoints: ["wta"],
  },
];

export function findMarqueeTournament(id: string): MarqueeTournament | null {
  return MARQUEE_TENNIS_TOURNAMENTS.find((t) => t.id === id) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Raw ESPN tennis shape (subset)                                             */
/* -------------------------------------------------------------------------- */

interface RawTennisFlag {
  href?: string;
  alt?: string;
}

interface RawTennisAthlete {
  id?: string;
  displayName?: string;
  shortName?: string;
  flag?: RawTennisFlag;
}

interface RawTennisLinescore {
  value?: number;
  tiebreak?: number;
  winner?: boolean;
}

/** ESPN's per-competitor seed wrapper (`curatedRank.current` = tournament seed). */
interface RawTennisCuratedRank {
  current?: number;
}

interface RawTennisCompetitor {
  id?: string;
  homeAway?: "home" | "away";
  winner?: boolean;
  athlete?: RawTennisAthlete;
  linescores?: RawTennisLinescore[];
  curatedRank?: RawTennisCuratedRank;
}

interface RawTennisStatus {
  type?: {
    state?: "pre" | "in" | "post";
    shortDetail?: string;
    name?: string;
  };
}

interface RawTennisCompetition {
  id?: string;
  date?: string;
  status?: RawTennisStatus;
  competitors?: RawTennisCompetitor[];
  notes?: { text?: string; type?: string }[];
  venue?: { fullName?: string; court?: string };
  type?: { text?: string; slug?: string };
  round?: { id?: string; displayName?: string };
  format?: { regulation?: { periods?: number } };
  broadcast?: string;
}

interface RawTennisGrouping {
  grouping?: { id?: string; slug?: string; displayName?: string };
  competitions?: RawTennisCompetition[];
}

interface RawTennisEvent {
  id?: string;
  name?: string;
  shortName?: string;
  date?: string;
  groupings?: RawTennisGrouping[];
  status?: RawTennisStatus;
}

interface RawTennisScoreboardResponse {
  events?: RawTennisEvent[] | null;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

function mapStatus(state: "pre" | "in" | "post" | undefined): Match["status"] {
  if (state === "in") return "live";
  if (state === "post") return "final";
  return "upcoming";
}

/**
 * Counts sets won (the outermost score in tennis) by summing the
 * `winner` flag on each linescores entry. Returns `undefined` when no
 * linescores are present.
 */
function countSetsWon(competitor: RawTennisCompetitor): number | undefined {
  const ls = competitor.linescores;
  if (!ls || ls.length === 0) return undefined;
  return ls.reduce((acc, l) => acc + (l.winner ? 1 : 0), 0);
}

/**
 * Builds the per-player tennis line (flag + set-by-set scores) consumed by
 * `TennisMatchCard`. Maps each ESPN linescore entry to a `TennisSetScore`
 * (games = `value`, plus the tiebreak points when present).
 */
function buildTennisPlayerLine(
  competitor: RawTennisCompetitor,
): TennisPlayerLine {
  const sets: TennisSetScore[] = (competitor.linescores ?? []).map((l) => ({
    games: l.value ?? 0,
    ...(typeof l.tiebreak === "number" ? { tiebreak: l.tiebreak } : {}),
    won: l.winner ?? false,
  }));
  return {
    flagUrl: competitor.athlete?.flag?.href,
    flagAlt: competitor.athlete?.flag?.alt,
    // Tournament seed (ESPN's only ranking signal); undefined when unseeded.
    ...(typeof competitor.curatedRank?.current === "number"
      ? { seed: competitor.curatedRank.current }
      : {}),
    sets,
    won: competitor.winner ?? false,
  };
}

/**
 * Maps an ESPN tennis competition (one match inside a grouping) to our
 * internal `Match` shape. Treats the two athletes as the home/away
 * "teams" of one. Logos are omitted — tennis has no team crest — which
 * triggers MatchCard's player-vs-player render path (Spec 05 Q5 R2 B
 * + T3.1).
 *
 * Returns `null` when the competition is missing structurally required
 * fields.
 */
function parseTennisCompetition(
  comp: RawTennisCompetition,
  tournament: MarqueeTournament,
  groupingDisplayName: string | undefined,
): Match | null {
  const competitors = comp.competitors ?? [];
  if (competitors.length < 2) return null;
  // ESPN tennis often omits homeAway; fall back to order-based assignment.
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  if (!home || !away) return null;
  const homeId = home.id ?? home.athlete?.id;
  const awayId = away.id ?? away.athlete?.id;
  if (!homeId || !awayId) return null;

  const homeName = home.athlete?.displayName ?? home.athlete?.shortName;
  const awayName = away.athlete?.displayName ?? away.athlete?.shortName;
  if (!homeName || !awayName) return null;

  const kickoffUtc = comp.date ?? null;
  const dateUtc = kickoffUtc ? kickoffUtc.slice(0, 10) : "";
  if (!dateUtc) return null;

  const status = mapStatus(comp.status?.type?.state);

  return {
    id: comp.id ?? `${tournament.id}-${homeId}-${awayId}-${dateUtc}`,
    sport: "Tennis",
    homeTeamId: homeId,
    homeTeamName: homeName,
    homeTeamShortName: home.athlete?.shortName,
    homeTeamLogo: undefined,
    awayTeamId: awayId,
    awayTeamName: awayName,
    awayTeamShortName: away.athlete?.shortName,
    awayTeamLogo: undefined,
    leagueId: tournament.id,
    leagueName: tournament.displayName,
    dateUtc,
    kickoffUtc,
    round: groupingDisplayName,
    venue: comp.venue?.fullName,
    broadcast: comp.broadcast,
    status,
    homeScore: status === "upcoming" ? undefined : countSetsWon(home),
    awayScore: status === "upcoming" ? undefined : countSetsWon(away),
    liveProgress:
      status === "live" ? comp.status?.type?.shortDetail : undefined,
    tennis: {
      bestOf: comp.format?.regulation?.periods,
      draw: comp.type?.text ?? groupingDisplayName,
      round: comp.round?.displayName,
      court: comp.venue?.court,
      home: buildTennisPlayerLine(home),
      away: buildTennisPlayerLine(away),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Scoreboard client                                                          */
/* -------------------------------------------------------------------------- */

type FetchFn = typeof fetch;

export interface TennisClientOptions {
  fetchFn?: FetchFn;
  signal?: AbortSignal;
  /**
   * IANA timezone used to bucket competitions by the user's *local* date
   * (consistent with the team-sport feed's `localDateOfMatch`). Defaults to
   * `"UTC"`, which reproduces a raw UTC-date comparison.
   */
  tz?: string;
}

/** Result of one tournament scoreboard fetch for a single local date. */
export interface TennisScoreboardResult {
  /** Matches whose local date equals the requested date. */
  matches: Match[];
  /** Earliest competition date across the whole draw (UTC `YYYY-MM-DD`). */
  eventStartDate?: string;
  /** Latest competition date across the whole draw (UTC `YYYY-MM-DD`). */
  eventEndDate?: string;
}

/**
 * Returns the local `YYYY-MM-DD` date of a UTC ISO timestamp in `tz`.
 * Mirrors `localDateOfMatch` so tennis buckets the same way team sports do.
 * Falls back to the raw UTC date slice when `tz` is invalid.
 */
function localDateOf(iso: string, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return iso.slice(0, 10);
  }
}

async function fetchTourScoreboard(
  tour: "atp" | "wta",
  date: string,
  opts: TennisClientOptions,
): Promise<RawTennisScoreboardResponse> {
  const url = buildTennisTourScoreboardUrl(tour, date);
  const f = opts.fetchFn ?? fetch;
  const res = await f(url, { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as RawTennisScoreboardResponse;
}

/**
 * Returns the matches for one marquee tournament on one *local* date, plus
 * the tournament's overall draw span. `matches` is empty when the tournament
 * has no play on that local date.
 *
 * Internally calls one or two tour-level ESPN endpoints (Slams hit both
 * atp + wta), filters events by tournament name, derives the draw span from
 * every round, and keeps only the competitions whose local date (in `opts.tz`)
 * equals `date`.
 */
export async function tennisScoreboard(
  tournamentId: string,
  date: string,
  opts: TennisClientOptions = {},
): Promise<TennisScoreboardResult> {
  const tournament = findMarqueeTournament(tournamentId);
  if (!tournament) return { matches: [] };

  const tz = opts.tz ?? "UTC";
  const responses = await Promise.all(
    tournament.tourEndpoints.map((tour) =>
      fetchTourScoreboard(tour, date, opts),
    ),
  );

  // ESPN's tennis scoreboard ignores the `dates=` query param and returns the
  // event's ENTIRE draw (every round across the fortnight). We use the whole
  // draw to derive the tournament's overall date span, and filter the matches
  // down to the requested *local* date so they land on the correct day tab.
  //
  // Dedupe by match id at the same time: a Slam queries both the atp + wta
  // endpoints, and ESPN returns the identical competition set from each, so
  // every match would otherwise appear twice — producing duplicate React keys
  // and doubling the live/upcoming/done counts.
  const byId = new Map<string, Match>();
  let eventStartDate: string | undefined;
  let eventEndDate: string | undefined;
  for (const data of responses) {
    if (!data.events) continue;
    for (const ev of data.events) {
      if (ev.name !== tournament.espnEventName) continue;
      const groupings = ev.groupings ?? [];
      for (const g of groupings) {
        const groupingName = g.grouping?.displayName;
        for (const comp of g.competitions ?? []) {
          if (!comp.date) continue;
          // Track the overall draw span (UTC dates) across every round.
          const utcDate = comp.date.slice(0, 10);
          if (!eventStartDate || utcDate < eventStartDate)
            eventStartDate = utcDate;
          if (!eventEndDate || utcDate > eventEndDate) eventEndDate = utcDate;
          // Keep only matches on the requested local day.
          if (localDateOf(comp.date, tz) !== date) continue;
          const m = parseTennisCompetition(comp, tournament, groupingName);
          if (m && !byId.has(m.id)) byId.set(m.id, m);
        }
      }
    }
  }
  return { matches: [...byId.values()], eventStartDate, eventEndDate };
}
