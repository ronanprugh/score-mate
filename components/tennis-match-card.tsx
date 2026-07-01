import type { Match, TennisPlayerLine } from "@/lib/sports/types";

interface Props {
  match: Match;
}

const EMPTY_LINE: TennisPlayerLine = { sets: [], won: false };

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

/** One player row: flag + name on the left, a games cell per set on the right. */
function PlayerRow({
  name,
  line,
  numSets,
}: {
  name: string;
  line: TennisPlayerLine;
  numSets: number;
}) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        {line.flagUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={line.flagUrl}
            alt={line.flagAlt ?? ""}
            loading="lazy"
            className="h-3 w-[18px] shrink-0 rounded-[2px] object-cover"
          />
        ) : null}
        <span
          className={[
            "truncate text-[15px] leading-tight",
            line.won
              ? "font-semibold"
              : "font-normal text-zinc-600 dark:text-zinc-300",
          ].join(" ")}
          title={name}
        >
          {name}
        </span>
        {typeof line.seed === "number" ? (
          <span
            data-testid="player-seed"
            className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500"
            aria-label={`seed ${line.seed}`}
          >
            ({line.seed})
          </span>
        ) : null}
      </div>
      {Array.from({ length: numSets }, (_, i) => {
        const set = line.sets[i];
        return (
          <span
            key={i}
            className={[
              "text-center text-[15px] tabular-nums",
              set?.won
                ? "font-semibold text-zinc-900 dark:text-zinc-50"
                : "font-normal text-zinc-500 dark:text-zinc-400",
            ].join(" ")}
          >
            {set ? (
              <>
                {set.games}
                {typeof set.tiebreak === "number" ? (
                  <sup className="text-[9px] font-normal text-zinc-400">
                    {set.tiebreak}
                  </sup>
                ) : null}
              </>
            ) : (
              ""
            )}
          </span>
        );
      })}
    </>
  );
}

/**
 * Tennis-specific match card: players stacked one above the other with a
 * games-per-set column for each (winner of each set bolded, tiebreak points
 * as a superscript). Best-of detail sits top-right; draw / round / court sit
 * bottom-right; broadcast bottom-left. Distinct from the team-sport
 * `MatchCard` (home-vs-away horizontal layout).
 */
export function TennisMatchCard({ match }: Props) {
  const {
    homeTeamName,
    awayTeamName,
    status,
    kickoffUtc,
    broadcast,
    venue,
    tennis,
  } = match;

  const home = tennis?.home ?? EMPTY_LINE;
  const away = tennis?.away ?? EMPTY_LINE;
  const numSets = Math.max(home.sets.length, away.sets.length);

  const statusLabel =
    status === "final"
      ? "Final"
      : status === "live"
        ? (match.liveProgress ?? "Live")
        : formatKickoffLocal(kickoffUtc);

  const drawRound = [tennis?.draw, tennis?.round].filter(Boolean).join(", ");
  const place = [tennis?.court, venue].filter(Boolean).join(", ");

  return (
    <article
      data-testid="match-card"
      data-status={status}
      aria-label={`${homeTeamName} vs ${awayTeamName} — ${status}`}
      className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-background p-2.5 shadow-sm dark:border-zinc-800"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={[
            "inline-flex items-center gap-1.5 text-xs",
            status === "live"
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400",
          ].join(" ")}
        >
          {status === "live" ? (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-400"
            />
          ) : null}
          {statusLabel}
        </span>
        {tennis?.bestOf ? (
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            Best of {tennis.bestOf}
          </span>
        ) : null}
      </div>

      <div
        className="grid items-center gap-x-2.5 gap-y-1.5"
        style={{
          gridTemplateColumns: `minmax(0,1fr) repeat(${numSets}, minmax(1.25rem, auto))`,
        }}
      >
        <PlayerRow name={homeTeamName} line={home} numSets={numSets} />
        <PlayerRow name={awayTeamName} line={away} numSets={numSets} />
      </div>

      {(broadcast || drawRound || place) && (
        <div className="flex items-end justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {broadcast ?? ""}
          </span>
          <div className="text-right">
            {drawRound ? (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {drawRound}
              </div>
            ) : null}
            {place ? (
              <div className="text-xs text-zinc-400 dark:text-zinc-500">
                {place}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}
