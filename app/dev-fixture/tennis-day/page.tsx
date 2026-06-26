/**
 * Dev-only fixture page for Spec 06 T3.6 screenshots.
 * Renders a tournament card as it appears on the Yesterday tab — expandable to
 * that day's completed matches. NOT linked from any production route or nav.
 */
"use client";

import type { ActiveTournament } from "@/lib/home/tennis-aggregator";
import type { Match } from "@/lib/sports/types";
import { TournamentCard } from "@/components/tournament-card";

const finalMatch = (
  id: string,
  home: string,
  away: string,
  homeFlag: string,
  awayFlag: string,
  homeSets: { games: number; tiebreak?: number; won: boolean }[],
  awaySets: { games: number; tiebreak?: number; won: boolean }[],
  court: string,
): Match => ({
  id,
  sport: "Tennis",
  homeTeamId: `${id}-h`,
  homeTeamName: home,
  awayTeamId: `${id}-a`,
  awayTeamName: away,
  leagueId: "tennis/slam/wimbledon",
  leagueName: "Wimbledon",
  dateUtc: "2026-06-28",
  kickoffUtc: "2026-06-28T12:00:00Z",
  venue: "London, Great Britain",
  broadcast: "ESPN+",
  status: "final",
  homeScore: homeSets.filter((s) => s.won).length,
  awayScore: awaySets.filter((s) => s.won).length,
  tennis: {
    bestOf: 5,
    draw: "Men's Singles",
    round: "Round 1",
    court,
    home: { flagUrl: homeFlag, flagAlt: "", won: true, sets: homeSets },
    away: { flagUrl: awayFlag, flagAlt: "", won: false, sets: awaySets },
  },
});

const ITA = "https://a.espncdn.com/i/teamlogos/countries/500/ita.png";
const POR = "https://a.espncdn.com/i/teamlogos/countries/500/por.png";
const ESP = "https://a.espncdn.com/i/teamlogos/countries/500/esp.png";
const FRA = "https://a.espncdn.com/i/teamlogos/countries/500/fra.png";

const WIMBLEDON: ActiveTournament = {
  id: "tennis/slam/wimbledon",
  displayName: "Wimbledon",
  tour: "Slam",
  startDate: "2026-06-29",
  endDate: "2026-07-12",
  currentRound: "Round 1",
  liveCount: 0,
  upcomingCount: 0,
  doneCount: 2,
  matches: [
    finalMatch(
      "157650",
      "Lorenzo Sonego",
      "Jaime Faria",
      ITA,
      POR,
      [
        { games: 6, won: true },
        { games: 6, won: true },
        { games: 6, won: true },
      ],
      [
        { games: 3, won: false },
        { games: 4, won: false },
        { games: 2, won: false },
      ],
      "Court 8",
    ),
    finalMatch(
      "157702",
      "Carlos Alcaraz",
      "Terence Atmane",
      ESP,
      FRA,
      [
        { games: 6, won: true },
        { games: 7, tiebreak: 7, won: true },
      ],
      [
        { games: 1, won: false },
        { games: 6, tiebreak: 2, won: false },
      ],
      "Centre Court",
    ),
  ],
};

export default function TennisDayFixture() {
  return (
    <main className="mx-auto max-w-md p-4">
      <p className="mb-3 text-[10px] uppercase tracking-wide text-zinc-500">
        Yesterday · Jun 28
      </p>
      <TournamentCard tournament={WIMBLEDON} defaultOpen />
    </main>
  );
}
