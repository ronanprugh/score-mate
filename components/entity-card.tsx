import Link from "next/link";
import type { Match } from "@/lib/sports/types";
import type { TeamEntity } from "@/lib/teams/types";
import { EntityMatchCard } from "./entity-match-card";

interface Props {
  entity: TeamEntity;
}

/**
 * One labelled slot in the card stack — "Last" or "Next" — holding either a
 * match card or that side's empty copy.
 *
 * The label matters more than it used to: with a full score card in each slot
 * and only one of them sometimes present, "Liverpool 2 – 4 Leeds United" alone
 * would not say whether that game has been played or is coming up.
 */
function MatchSlot({
  label,
  match,
  emptyText,
}: {
  label: string;
  match: Match | null;
  emptyText: string;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </h4>
      {match ? (
        <EntityMatchCard match={match} />
      ) : (
        <p className="rounded-md border border-dashed border-zinc-200 px-3 py-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {emptyText}
        </p>
      )}
    </section>
  );
}

/**
 * One followed team or player on the Teams list: a crest + name header that
 * links to the entity's detail screen, followed by their most recent and next
 * match as full score cards (Spec 13, Unit 3).
 *
 * The cards are the same components Home renders, so a match reads identically
 * wherever it appears. When both sides are null the card collapses to a single
 * "Match data unavailable" message; otherwise each missing side shows its own
 * empty copy.
 */
export function EntityCard({ entity }: Props) {
  const { displayName, badgeUrl, lastMatch, nextMatch } = entity;
  const bothUnavailable = lastMatch === null && nextMatch === null;

  return (
    <article
      data-testid="entity-card"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
    >
      <Link
        href={`/teams/${entity.favoriteId}`}
        aria-label={`View ${displayName} matches`}
        className="-m-1 flex min-h-11 items-center gap-2 rounded p-1 outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900/50"
      >
        {badgeUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external ESPN crest, not a local asset
          <img
            src={badgeUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-6 w-6 shrink-0 object-contain"
          />
        )}
        <h3 className="truncate font-semibold">{displayName}</h3>
      </Link>

      {bothUnavailable ? (
        <p className="text-sm text-zinc-500">Match data unavailable</p>
      ) : (
        <div className="flex flex-col gap-3">
          <MatchSlot
            label="Last"
            match={lastMatch}
            emptyText="No recent match"
          />
          <MatchSlot
            label="Next"
            match={nextMatch}
            emptyText="No upcoming match"
          />
        </div>
      )}
    </article>
  );
}
