import type { Match } from "@/lib/sports/types";

interface Props {
  match: Match;
}

function formatKickoffLocal(iso: string | null): string {
  if (!iso) return "TBD";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "TBD";
  }
}

export function MatchCard({ match }: Props) {
  const {
    status,
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    round,
    venue,
    broadcast,
    liveProgress,
    kickoffUtc,
  } = match;

  const hasScores =
    (status === "live" || status === "final") &&
    typeof homeScore === "number" &&
    typeof awayScore === "number";

  // The centerpiece between the two team names. Scores when we have them,
  // kickoff time for upcoming, em-dash otherwise.
  const centerLabel = hasScores
    ? `${homeScore} – ${awayScore}`
    : status === "upcoming"
      ? formatKickoffLocal(kickoffUtc)
      : "–";

  const showFooter =
    status === "final" ||
    status === "live" ||
    Boolean(round) ||
    Boolean(venue) ||
    (status === "upcoming" && Boolean(broadcast));

  return (
    <article
      data-testid="match-card"
      data-status={status}
      aria-label={`${homeTeamName} vs ${awayTeamName} — ${status}`}
      className="flex min-h-16 flex-col justify-between gap-1.5 rounded-md border border-zinc-200 bg-background p-2.5 shadow-sm dark:border-zinc-800"
    >
      <div className="flex items-center gap-2">
        <span
          className="min-w-0 flex-1 truncate text-right text-sm font-semibold leading-tight"
          title={homeTeamName}
        >
          {homeTeamName}
        </span>
        <span
          data-testid="match-center"
          className={[
            "shrink-0 tabular-nums",
            hasScores
              ? "text-sm font-semibold"
              : "text-xs font-medium text-zinc-600 dark:text-zinc-300",
          ].join(" ")}
          aria-label={
            hasScores
              ? `${homeTeamName} ${homeScore}, ${awayTeamName} ${awayScore}`
              : undefined
          }
        >
          {hasScores ? (
            <>
              <span data-testid="home-score">{homeScore}</span>
              <span aria-hidden="true" className="px-1 text-zinc-400">
                –
              </span>
              <span data-testid="away-score">{awayScore}</span>
            </>
          ) : (
            <span
              data-testid={status === "upcoming" ? "upcoming-time" : undefined}
            >
              {centerLabel}
            </span>
          )}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold leading-tight"
          title={awayTeamName}
        >
          {awayTeamName}
        </span>
      </div>

      {showFooter && (
        <footer className="flex items-center gap-2 text-[10px] text-zinc-500">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            {status === "final" && (
              <span
                data-testid="final-label"
                className="font-semibold uppercase tracking-wide"
              >
                Final
              </span>
            )}
            {status === "live" && liveProgress && (
              <span
                data-testid="live-progress"
                className="font-medium text-red-600 dark:text-red-400"
              >
                {liveProgress}
              </span>
            )}
            {round && (
              <span className="truncate uppercase tracking-wide" title={round}>
                {round}
              </span>
            )}
            {venue && (
              <span className="truncate" title={venue}>
                {venue}
              </span>
            )}
            {status === "upcoming" && broadcast && (
              <span
                data-testid="broadcast"
                className="truncate"
                title={broadcast}
              >
                {broadcast}
              </span>
            )}
          </div>
          {status === "live" && (
            <span
              data-testid="live-pill"
              className="inline-flex shrink-0 animate-pulse items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
            >
              Live
            </span>
          )}
        </footer>
      )}
    </article>
  );
}
