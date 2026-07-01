/**
 * Dev-only fixture page for Spec 08 screenshots (extends the Spec 06 fixture).
 * Renders a tournament card with a full 32 + 32 singles draw plus doubles /
 * mixed and a live match, so the discipline sections, top-5 truncation,
 * "Show more", and live pinning are all demonstrable. NOT linked from any
 * production route or nav.
 */
"use client";

import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import type { Match, MatchStatus } from "@/lib/sports/types";
import { TournamentCard } from "@/components/tournament-card";

const FLAGS = [
  "esp",
  "ita",
  "srb",
  "gbr",
  "usa",
  "fra",
  "ger",
  "rus",
  "gre",
  "aus",
].map((c) => `https://a.espncdn.com/i/teamlogos/countries/500/${c}.png`);

function flag(i: number): string {
  return FLAGS[i % FLAGS.length]!;
}

interface Spec {
  id: string;
  draw: string;
  home: string;
  away: string;
  homeSeed?: number;
  awaySeed?: number;
  status?: MatchStatus;
  kickoffUtc?: string;
}

function build(spec: Spec, idx: number): Match {
  const status = spec.status ?? "upcoming";
  return {
    id: spec.id,
    sport: "Tennis",
    homeTeamId: `${spec.id}-h`,
    homeTeamName: spec.home,
    awayTeamId: `${spec.id}-a`,
    awayTeamName: spec.away,
    leagueId: "tennis/slam/wimbledon",
    leagueName: "Wimbledon",
    dateUtc: "2026-06-29",
    kickoffUtc:
      spec.kickoffUtc ??
      `2026-06-29T${String(11 + (idx % 8)).padStart(2, "0")}:00:00Z`,
    venue: "London, Great Britain",
    broadcast: "ESPN+",
    status,
    ...(status === "live" ? { liveProgress: "Set 2" } : {}),
    tennis: {
      bestOf: spec.draw.includes("Doubles") ? 3 : 5,
      draw: spec.draw,
      round: "Round 1",
      home: {
        sets: status === "upcoming" ? [] : [{ games: 6, won: true }],
        won: false,
        ...(spec.homeSeed ? { seed: spec.homeSeed } : {}),
      },
      away: {
        sets: status === "upcoming" ? [] : [{ games: 4, won: false }],
        won: false,
        ...(spec.awaySeed ? { seed: spec.awaySeed } : {}),
      },
    },
  };
}

/** Builds a 32-match singles draw: a few seed-vs-seed, the rest seed-vs-unseeded. */
function singlesDraw(
  draw: string,
  seededNames: string[],
  prefix: string,
): Spec[] {
  const specs: Spec[] = [];
  for (let i = 0; i < 32; i++) {
    const seed = i + 1;
    const isMarquee = i < 4; // top 4 face another seed → best priority
    specs.push({
      id: `${prefix}-${i}`,
      draw,
      home: seededNames[i] ?? `${prefix} Seed ${seed}`,
      away: isMarquee
        ? (seededNames[31 - i] ?? `${prefix} Seed ${32 - i}`)
        : `${prefix} Qualifier ${i}`,
      homeSeed: seed,
      ...(isMarquee ? { awaySeed: 32 - i } : {}),
    });
  }
  return specs;
}

const MEN = [
  "Carlos Alcaraz",
  "Jannik Sinner",
  "Novak Djokovic",
  "Jack Draper",
  "Taylor Fritz",
  "Alexander Zverev",
];
const WOMEN = [
  "Aryna Sabalenka",
  "Iga Swiatek",
  "Coco Gauff",
  "Elena Rybakina",
  "Jessica Pegula",
  "Qinwen Zheng",
];

const specs: Spec[] = [
  ...singlesDraw("Men's Singles", MEN, "MS"),
  ...singlesDraw("Women's Singles", WOMEN, "WS"),
  // A live men's match between two low/unseeded players — must pin to the top
  // of Men's Singles despite its poor priority.
  {
    id: "MS-live",
    draw: "Men's Singles",
    home: "Live Underdog",
    away: "Wildcard Entrant",
    status: "live",
  },
  // A few doubles + mixed matches.
  {
    id: "MD-1",
    draw: "Men's Doubles",
    home: "Team A1 / A2",
    away: "Team B1 / B2",
    homeSeed: 2,
  },
  {
    id: "MD-2",
    draw: "Men's Doubles",
    home: "Team C1 / C2",
    away: "Team D1 / D2",
  },
  {
    id: "WD-1",
    draw: "Women's Doubles",
    home: "Team E1 / E2",
    away: "Team F1 / F2",
    homeSeed: 1,
  },
  {
    id: "XD-1",
    draw: "Mixed Doubles",
    home: "Pair G",
    away: "Pair H",
    homeSeed: 3,
  },
  { id: "XD-2", draw: "Mixed Doubles", home: "Pair I", away: "Pair J" },
];

const matches: Match[] = specs.map((s, i) => {
  const m = build(s, i);
  const t = m.tennis!;
  return {
    ...m,
    tennis: {
      ...t,
      home: { ...t.home, flagUrl: flag(i), flagAlt: "" },
      away: { ...t.away, flagUrl: flag(i + 3), flagAlt: "" },
    },
  };
});

const WIMBLEDON: ActiveTournament = {
  id: "tennis/slam/wimbledon",
  displayName: "Wimbledon",
  tour: "Slam",
  startDate: "2026-06-29",
  endDate: "2026-07-12",
  currentRound: "Round 1",
  liveCount: matches.filter((m) => m.status === "live").length,
  upcomingCount: matches.filter((m) => m.status === "upcoming").length,
  doneCount: matches.filter((m) => m.status === "final").length,
  matches,
};

export default function TennisDayFixture() {
  return (
    <main className="mx-auto max-w-md p-4">
      <p className="mb-3 text-[10px] uppercase tracking-wide text-zinc-500">
        Today · Jun 29 — Spec 08 fixture (32 + 32 draw)
      </p>
      <TournamentCard tournament={WIMBLEDON} />
    </main>
  );
}
