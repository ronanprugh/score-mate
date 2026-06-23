"use client";

import { useState } from "react";
import type { FavoriteType, Sport } from "@/lib/sportsdb/types";

export interface FavoritePayload {
  type: FavoriteType;
  externalId: string;
  displayName: string;
  sport: Sport;
  metadata?: { startDate?: string; endDate?: string };
}

interface Props {
  payload: FavoritePayload;
  /** When true, the button starts in the "Added" state. */
  initialAdded: boolean;
}

type Status = "idle" | "pending" | "added" | "error";

/**
 * Optimistic Add toggle. POSTs to /api/favorites on click; the button
 * transitions to "Added" immediately, then reconciles when the server
 * responds. Server failure rolls the button back and surfaces an inline
 * non-technical message.
 *
 * 44×44 touch target via `min-h-11 min-w-11`.
 */
export function FavoriteAddButton({ payload, initialAdded }: Props) {
  const [status, setStatus] = useState<Status>(initialAdded ? "added" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (status === "added" || status === "pending") return;
    setError(null);
    setStatus("pending");
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            "You're adding favorites too fast. Try again in a minute.",
          );
        }
        throw new Error("Couldn't add this favorite. Please try again.");
      }
      setStatus("added");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const isAdded = status === "added";
  const isPending = status === "pending";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isAdded || isPending}
        aria-pressed={isAdded}
        aria-label={
          isAdded
            ? `Remove ${payload.displayName} from favorites — use the My Favorites screen`
            : `Add ${payload.displayName} to favorites`
        }
        className={[
          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors",
          isAdded
            ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            : "bg-foreground text-background hover:opacity-90 disabled:opacity-60",
        ].join(" ")}
      >
        {isAdded ? "Added" : isPending ? "Adding…" : "Add"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
