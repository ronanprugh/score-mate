"use client";

interface Props {
  favoriteId: string;
  displayName: string;
}

/**
 * Owns the `/api/teams/[favoriteId]/matches` fetch and the chronological
 * match-history layout for one followed team/player. Data fetching (Task
 * 2.0/3.0) and the chronological layout (Task 4.0) are added on top of this
 * shell.
 */
export function EntityMatchesClient({ favoriteId }: Props) {
  return (
    <p className="text-sm text-zinc-500" aria-live="polite">
      Loading matches for {favoriteId}…
    </p>
  );
}
