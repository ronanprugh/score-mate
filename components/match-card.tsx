import type { Match } from "@/lib/sportsdb/types";

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
    leagueName,
    round,
    venue,
    broadcast,
    liveProgress,
    kickoffUtc,
  } = match;

  return (
    <article
      data-testid="match-card"
      data-status={status}
      aria-label={`${homeTeamName} vs ${awayTeamName} — ${status}`}
      className="flex min-h-20 flex-col justify-between gap-1.5 rounded-md border border-zinc-200 bg-background p-2.5 shadow-sm dark:border-zinc-800"
    >
      <header className="flex items-center justify-between gap-2">
        <span
          className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500"
          title={leagueName}
        >
          {leagueName}
          {round ? ` · ${round}` : ""}
        </span>
        {status === "live" && (
          <span
            data-testid="live-pill"
            className="inline-flex animate-pulse items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
          >
            Live
          </span>
        )}
        {status === "final" && (
          <span
            data-testid="final-label"
            className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500"
          >
            Final
          </span>
        )}
        {status === "upcoming" && (
          <span
            data-testid="upcoming-time"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300"
            aria-label={`Kickoff at ${formatKickoffLocal(kickoffUtc)}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-2.5 w-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
            </svg>
            {formatKickoffLocal(kickoffUtc)}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight"
            title={homeTeamName}
          >
            {homeTeamName}
          </span>
          {(status === "live" || status === "final") &&
            typeof homeScore === "number" && (
              <span
                data-testid="home-score"
                className="text-sm font-semibold tabular-nums"
              >
                {homeScore}
              </span>
            )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight"
            title={awayTeamName}
          >
            {awayTeamName}
          </span>
          {(status === "live" || status === "final") &&
            typeof awayScore === "number" && (
              <span
                data-testid="away-score"
                className="text-sm font-semibold tabular-nums"
              >
                {awayScore}
              </span>
            )}
        </div>
      </div>

      {(liveProgress || venue || (status === "upcoming" && broadcast)) && (
        <footer className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-500">
          {status === "live" && liveProgress && (
            <span
              data-testid="live-progress"
              className="font-medium text-red-600 dark:text-red-400"
            >
              {liveProgress}
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
        </footer>
      )}
    </article>
  );
}
