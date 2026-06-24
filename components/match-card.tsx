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
  shortName?: string;
  logo?: string;
  align: "right" | "left";
  /**
   * "winner" → keep default emphasis;
   * "loser"  → dim (text-zinc-400, font-normal) to make the result obvious;
   * "neutral" → no result distinction (live / upcoming / tie).
   */
  outcome: "winner" | "loser" | "neutral";
}

/**
 * Splits `displayName` into `[prefix, mascot]` when the mascot is a
 * trailing suffix of the display name. Rule: if `displayName` ends with
 * `shortName` and there is a non-empty prefix, return [prefix, shortName].
 * Otherwise return [null, displayName] (one-line render).
 *
 * Handles:
 *   "Kansas City Chiefs"      + "Chiefs"     → ["Kansas City", "Chiefs"]
 *   "Los Angeles Lakers"      + "Lakers"     → ["Los Angeles", "Lakers"]
 *   "AFC Bournemouth"         + "Bournemouth"→ ["AFC", "Bournemouth"]
 *   "Arsenal"                 + "Arsenal"    → [null, "Arsenal"]
 *   "Atlético Madrid"         + "Atlético"   → [null, "Atlético Madrid"]
 *   "Brighton & Hove Albion"  + "Brighton"   → [null, "Brighton & Hove Albion"]
 */
function splitTeamName(
  name: string,
  shortName?: string,
): [string | null, string] {
  if (!shortName) return [null, name];
  if (shortName === name) return [null, name];
  if (!name.endsWith(shortName)) return [null, name];
  const prefix = name.slice(0, -shortName.length).trim();
  if (!prefix) return [null, name];
  return [prefix, shortName];
}

function TeamSide({ name, shortName, logo, align, outcome }: TeamSideProps) {
  const isRight = align === "right";
  const dim = outcome === "loser";
  const [prefix, mascot] = splitTeamName(name, shortName);
  return (
    <div
      className={[
        "flex min-w-0 flex-1 items-center gap-2",
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
            "mx-1 h-7 w-7 shrink-0 object-contain transition-opacity",
            dim ? "opacity-50" : "",
          ].join(" ")}
        />
      ) : (
        <div
          aria-hidden="true"
          className={[
            "mx-1 h-7 w-7 shrink-0 rounded-sm bg-zinc-100 dark:bg-zinc-800",
            dim ? "opacity-50" : "",
          ].join(" ")}
        />
      )}
      <div
        className={[
          "flex min-w-0 flex-1 flex-col leading-tight transition-colors",
          isRight ? "items-end text-right" : "items-start text-left",
          dim ? "text-zinc-400 dark:text-zinc-500" : "",
        ].join(" ")}
        title={name}
      >
        {prefix && (
          <span
            className={[
              "max-w-full truncate text-xs",
              dim
                ? "font-normal"
                : "font-normal text-zinc-500 dark:text-zinc-400",
            ].join(" ")}
          >
            {prefix}
          </span>
        )}
        <span
          className={[
            "max-w-full truncate text-base",
            dim ? "font-normal" : "font-semibold",
          ].join(" ")}
        >
          {mascot}
        </span>
      </div>
    </div>
  );
}

export function MatchCard({ match }: Props) {
  const {
    status,
    homeTeamName,
    homeTeamShortName,
    awayTeamName,
    awayTeamShortName,
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
      className="flex min-h-20 flex-col justify-between gap-1 rounded-md border border-zinc-200 bg-background px-6 py-3 shadow-sm dark:border-zinc-800"
    >
      <div className="flex items-center gap-2">
        <TeamSide
          name={homeTeamName}
          shortName={homeTeamShortName}
          logo={homeTeamLogo}
          align="right"
          outcome={homeOutcome}
        />
        <span
          data-testid="match-center"
          className={[
            // Fixed width so the outer flex-1 team blocks always reserve the
            // same space — logos stay pinned to the card edges regardless of
            // whether the center reads "0 – 0", "100 – 99", or "7:30 PM".
            "w-20 shrink-0 text-center tabular-nums",
            hasScores
              ? "text-base font-semibold"
              : "text-sm font-medium text-zinc-600 dark:text-zinc-300",
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
          shortName={awayTeamShortName}
          logo={awayTeamLogo}
          align="left"
          outcome={awayOutcome}
        />
      </div>

      {showFooter && (
        <footer className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            {status === "final" && (
              <span
                data-testid="final-label"
                className="font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200"
              >
                Final
              </span>
            )}
            {status === "live" && liveProgress && (
              <span
                data-testid="live-progress"
                className="font-semibold text-red-600 dark:text-red-400"
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
              className="inline-flex shrink-0 animate-pulse items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            >
              Live
            </span>
          )}
        </footer>
      )}
    </article>
  );
}
