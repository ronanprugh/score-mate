"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  favoriteId: string;
  displayName: string;
}

type Status = "idle" | "pending" | "error";

/**
 * Optimistic Remove. DELETEs to /api/favorites/[id]; on success, calls
 * `router.refresh()` so the server component re-renders without the row.
 * On failure, surfaces an inline non-technical message and leaves the row
 * in place.
 */
export function FavoriteRemoveButton({ favoriteId, displayName }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (status === "pending") return;
    setError(null);
    setStatus("pending");
    try {
      const res = await fetch(
        `/api/favorites/${encodeURIComponent(favoriteId)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok && res.status !== 204) {
        throw new Error("Couldn't remove this favorite. Please try again.");
      }
      // Server component re-fetches the (now-shorter) list.
      router.refresh();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "pending"}
        aria-label={`Remove ${displayName} from favorites`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {status === "pending" ? "Removing…" : "Remove"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
