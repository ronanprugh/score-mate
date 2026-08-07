import type { Match } from "@/lib/sports/types";
import { MatchCard } from "./match-card";
import { TennisMatchCard } from "./tennis-match-card";

/**
 * Renders a match with the same card Home uses for its sport.
 *
 * Shared by the Teams list (`EntityCard`) and the entity detail screen
 * (`EntityMatchesClient`) so a match looks identical everywhere it appears.
 *
 * Opts into `showLeagueName`: unlike Home, neither Teams surface groups by
 * league, and both mix competitions on one screen — so a friendly needs to say
 * it is a friendly on the card itself.
 */
export function EntityMatchCard({ match }: { match: Match }) {
  return match.sport === "Tennis" ? (
    <TennisMatchCard match={match} />
  ) : (
    <MatchCard match={match} showLeagueName />
  );
}
