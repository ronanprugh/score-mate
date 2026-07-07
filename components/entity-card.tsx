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

function MatchRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 truncate text-right">{children}</span>
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
    <article
      data-testid="entity-card"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
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
        <div className="flex flex-col gap-2">
          <MatchRow label="Last match">
            {lastMatch ? (
              <>
                {lastMatch.score && (
                  <span className="font-semibold">{lastMatch.score}</span>
                )}{" "}
                <span className="text-zinc-600 dark:text-zinc-400">
                  vs {lastMatch.opponentName}
                </span>{" "}
                <span className="text-zinc-400">
                  {formatShortDate(lastMatch.date)}
                </span>
              </>
            ) : (
              <span className="text-zinc-500">No recent match</span>
            )}
          </MatchRow>
          <MatchRow label="Next match">
            {nextMatch ? (
              <>
                <span className="text-zinc-600 dark:text-zinc-400">
                  vs {nextMatch.opponentName}
                </span>{" "}
                <span className="text-zinc-400">
                  {formatKickoff(nextMatch)}
                </span>
              </>
            ) : (
              <span className="text-zinc-500">No upcoming match</span>
            )}
          </MatchRow>
        </div>
      )}
    </article>
  );
}
