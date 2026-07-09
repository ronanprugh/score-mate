import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findCatalogTeamById } from "@/lib/espn/catalog";
import { listFavoritesForUser } from "@/lib/favorites/queries";
import { EntityMatchesClient } from "@/components/entity-matches-client";

export const metadata: Metadata = {
  title: "Matches · ScoreMate",
};

interface Props {
  params: Promise<{ favoriteId: string }>;
}

/**
 * Match-history detail screen for one followed team or player. Reached by
 * tapping an `EntityCard` on the Teams tab. Resolves the favorite server-side
 * (not from client state) so the URL works on direct load/refresh, then
 * renders a header (name + badge + back) and hands off to
 * `EntityMatchesClient` for the match list.
 */
export default async function EntityDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const { favoriteId } = await params;
  const favorites = await listFavoritesForUser(session.user.id);
  const favorite = favorites.find(
    (f) => f.id === favoriteId && (f.type === "team" || f.type === "player"),
  );

  if (!favorite) {
    return (
      <main className="flex flex-1 flex-col px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-lg font-semibold">Not found</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            We couldn&apos;t find that team or player in your favorites.
          </p>
          <Link
            href="/teams"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
          >
            Back to Teams
          </Link>
        </div>
      </main>
    );
  }

  const badgeUrl =
    favorite.type === "team"
      ? findCatalogTeamById(
          favorite.externalId,
          favorite.sport,
          favorite.displayName,
        )?.badgeUrl
      : undefined;

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        <header className="flex items-center gap-3">
          <Link
            href="/teams"
            aria-label="Back to Teams"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.5 4L6.5 10L12.5 16" />
            </svg>
          </Link>
          {badgeUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external ESPN crest, not a local asset
            <img
              src={badgeUrl}
              alt=""
              aria-hidden
              className="h-8 w-8 shrink-0 object-contain"
            />
          )}
          <h1 className="truncate text-lg font-semibold">
            {favorite.displayName}
          </h1>
        </header>

        <EntityMatchesClient
          favoriteId={favorite.id}
          displayName={favorite.displayName}
        />
      </div>
    </main>
  );
}
