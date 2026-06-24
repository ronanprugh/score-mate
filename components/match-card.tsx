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

interface TeamSideProps {
  name: string;
  logo?: string;
  score?: number;
  align: "right" | "left";
  /**
   * "winner" → keep default emphasis;
   * "loser"  → dim (text-zinc-400, font-normal) to make the result obvious;
   * "neutral" → no result distinction (live / upcoming / tie).
   */
  outcome: "winner" | "loser" | "neutral";
}

function TeamSide({ name, logo, align, outcome }: TeamSideProps) {
  const isRight = align === "right";
  const dim = outcome === "loser";
  return (
    <div
      className={[
        "flex min-w-0 flex-1 items-center gap-1.5",
        isRight ? "flex-row-reverse" : "flex-row",
      ].join(" ")}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          loading="lazy"
          className={[
            "h-5 w-5 shrink-0 object-contain transition-opacity",
            dim ? "opacity-50" : "",
          ].join(" ")}
        />
      ) : (
        <div
          aria-hidden="true"
          className={[
            "h-5 w-5 shrink-0 rounded-sm bg-zinc-100 dark:bg-zinc-800",
            dim ? "opacity-50" : "",
          ].join(" ")}
        />
      )}
      <span
        className={[
          "min-w-0 flex-1 truncate text-sm leading-tight transition-colors",
          isRight ? "text-right" : "text-left",
          dim
            ? "font-normal text-zinc-400 dark:text-zinc-500"
            : "font-semibold",
        ].join(" ")}
        title={name}
      >
        {name}
      </span>
    </div>
  );
}

export function MatchCard({ match }: Props) {
  const {
    status,
    homeTeamName,
    awayTeamName,
    homeTeamLogo,
    awayTeamLogo,
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

  // Only highlight the winner on a settled (final) match — live scores can
  // flip, and a draw shouldn't visually favor either side.
  const homeOutcome: TeamSideProps["outcome"] =
    status === "final" && hasScores && homeScore !== awayScore
      ? homeScore! > awayScore!
        ? "winner"
        : "loser"
      : "neutral";
  const awayOutcome: TeamSideProps["outcome"] =
    status === "final" && hasScores && homeScore !== awayScore
      ? awayScore! > homeScore!
        ? "winner"
        : "loser"
      : "neutral";

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
        <TeamSide
          name={homeTeamName}
          logo={homeTeamLogo}
          align="right"
          outcome={homeOutcome}
        />
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
              <span
                data-testid="home-score"
                className={
                  homeOutcome === "loser"
                    ? "text-zinc-400 dark:text-zinc-500"
                    : ""
                }
              >
                {homeScore}
              </span>
              <span aria-hidden="true" className="px-1 text-zinc-400">
                –
              </span>
              <span
                data-testid="away-score"
                className={
                  awayOutcome === "loser"
                    ? "text-zinc-400 dark:text-zinc-500"
                    : ""
                }
              >
                {awayScore}
              </span>
            </>
          ) : (
            <span
              data-testid={status === "upcoming" ? "upcoming-time" : undefined}
            >
              {status === "upcoming" ? formatKickoffLocal(kickoffUtc) : "–"}
            </span>
          )}
        </span>
        <TeamSide
          name={awayTeamName}
          logo={awayTeamLogo}
          align="left"
          outcome={awayOutcome}
        />
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
