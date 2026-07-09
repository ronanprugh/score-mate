import Link from "next/link";
import type { EntityMatch, TeamEntity } from "@/lib/teams/types";

interface Props {
  entity: TeamEntity;
}

/** "Jun 20" style short date from a YYYY-MM-DD (UTC) string. */
function formatShortDate(date: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

/** "Jun 28, 2:00 PM" local kickoff, or the short date when no time is known. */
function formatKickoff(match: EntityMatch): string {
  if (!match.kickoffUtc) return formatShortDate(match.date);
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(match.kickoffUtc));
  } catch {
    return formatShortDate(match.date);
  }
}

/** A small W / L pill, colored like a match result. */
function ResultBadge({ result }: { result: "W" | "L" }) {
  return (
    <span
      className={[
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold",
        result === "W"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
      ].join(" ")}
      aria-label={result === "W" ? "Win" : "Loss"}
    >
      {result}
    </span>
  );
}

/**
 * One match line: label + opponent + date on the top row, and (for completed
 * matches) the score on an indented second row so long tennis scores
 * ("7-5, 7-6, 6-3") stay readable on mobile.
 */
function MatchRow({
  label,
  match,
  showScore,
  emptyText,
}: {
  label: string;
  match: EntityMatch | null;
  showScore: boolean;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-11 shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        {match ? (
          <>
            {showScore && match.result && <ResultBadge result={match.result} />}
            <span className="min-w-0 flex-1 truncate">
              <span className="text-zinc-400">vs </span>
              <span className="text-zinc-800 dark:text-zinc-200">
                {match.opponentName}
              </span>
            </span>
            <span className="shrink-0 text-xs text-zinc-400">
              {showScore ? formatShortDate(match.date) : formatKickoff(match)}
            </span>
          </>
        ) : (
          <span className="flex-1 text-zinc-500">{emptyText}</span>
        )}
      </div>
      {match && showScore && match.score && (
        <div className="pl-[3.25rem] text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
          {match.score}
        </div>
      )}
    </div>
  );
}

/**
 * Presentational card for one followed team/player. Shows a "Last match" row
 * (score + opponent + short date) and a "Next match" row (opponent + kickoff).
 * When both matches are null the card shows a single "Match data unavailable"
 * message (the graceful player-fallback state from Task 4.0); otherwise each
 * missing side shows its own "No recent/upcoming match" copy.
 */
export function EntityCard({ entity }: Props) {
  const { displayName, badgeUrl, lastMatch, nextMatch } = entity;
  const bothUnavailable = lastMatch === null && nextMatch === null;

  return (
    <Link
      href={`/teams/${entity.favoriteId}`}
      data-testid="entity-card"
      aria-label={`View ${displayName} matches`}
      className="flex min-h-11 flex-col gap-3 rounded-lg border border-zinc-200 p-4 outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
    >
      <header className="flex items-center gap-2">
        {badgeUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external ESPN crest, not a local asset
          <img
            src={badgeUrl}
            alt=""
            aria-hidden
            className="h-6 w-6 shrink-0 object-contain"
          />
        )}
        <h3 className="truncate font-semibold">{displayName}</h3>
      </header>

      {bothUnavailable ? (
        <p className="text-sm text-zinc-500">Match data unavailable</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/60">
          <MatchRow
            label="Last"
            match={lastMatch}
            showScore
            emptyText="No recent match"
          />
          <MatchRow
            label="Next"
            match={nextMatch}
            showScore={false}
            emptyText="No upcoming match"
          />
        </div>
      )}
    </Link>
  );
}
