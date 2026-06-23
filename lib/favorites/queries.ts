/**
 * Server-side data layer for favorites.
 *
 * Every exported function takes `userId` as the FIRST argument and scopes
 * its query by that id server-side. Callers must pass `session.user.id` from
 * the Auth.js helper — NEVER a client-supplied user id, to prevent IDOR.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { favorites, type FavoriteRow } from "@/db/schema/favorites";
import type { CreateFavoriteInput } from "./validators";

export async function listFavoritesForUser(
  userId: string,
): Promise<FavoriteRow[]> {
  return db
    .select()
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
}

export interface CreateFavoriteResult {
  row: FavoriteRow;
  /** True if the row already existed (duplicate POST). */
  existed: boolean;
}

/**
 * Create a favorite for the given user. If a row already exists for
 * (userId, type, externalId) — the UNIQUE constraint — returns the existing
 * row with `existed: true` rather than throwing.
 *
 * Implementation: `INSERT ... ON CONFLICT DO NOTHING RETURNING *`. If the
 * returning array is empty, fall back to a scoped SELECT for the existing
 * row.
 */
export async function createFavorite(
  userId: string,
  input: CreateFavoriteInput,
): Promise<CreateFavoriteResult> {
  const inserted = await db
    .insert(favorites)
    .values({
      userId,
      type: input.type,
      externalId: input.externalId,
      displayName: input.displayName,
      sport: input.sport,
      metadata: input.metadata ?? null,
    })
    .onConflictDoNothing({
      target: [favorites.userId, favorites.type, favorites.externalId],
    })
    .returning();

  if (inserted.length > 0) {
    return { row: inserted[0]!, existed: false };
  }

  // Conflict: row already exists. Fetch it (still scoped by userId).
  const existing = await db
    .select()
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.type, input.type),
        eq(favorites.externalId, input.externalId),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    // Truly unreachable: the conflict says the row exists, but the scoped
    // select can't find it. Treat as a race condition; retry once.
    throw new Error(
      "createFavorite: conflict reported but scoped select returned 0 rows",
    );
  }
  return { row: existing[0], existed: true };
}

/**
 * Delete a favorite. Scoped by userId — calling user can ONLY delete rows
 * they own. Returns true if a row was deleted, false otherwise (either the
 * id doesn't exist or it belongs to a different user — the caller can't
 * distinguish the two cases by design, which is what we want for IDOR
 * protection).
 */
export async function deleteFavorite(
  userId: string,
  favoriteId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(favorites)
    .where(and(eq(favorites.id, favoriteId), eq(favorites.userId, userId)))
    .returning({ id: favorites.id });
  return deleted.length > 0;
}
