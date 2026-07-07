/**
 * Drizzle schema for the per-user `favorites` table.
 *
 * Spec § Technical Considerations exactly:
 *   - id           UUID PK
 *   - user_id      FK → users.id ON DELETE CASCADE
 *   - type         ENUM(team, sport, league, event)
 *   - external_id  TEXT — TheSportsDB id or canonical sport name
 *   - display_name TEXT
 *   - sport        TEXT — denormalized for fast filtering
 *   - metadata     JSONB — optional, e.g. event start/end dates
 *   - created_at   TIMESTAMP DEFAULT now()
 *   - UNIQUE (user_id, type, external_id)
 *   - INDEX  (user_id)
 *
 * Implementation note: id is `text` + `crypto.randomUUID()` (matching the
 * users table) rather than `uuid` + `defaultRandom()` so we don't depend on
 * the pgcrypto extension. The column is still semantically a UUID.
 */

import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import type { Sport } from "@/lib/sports/types";

export const favoriteTypeEnum = pgEnum("favorite_type", [
  "team",
  "sport",
  "league",
  "event",
  "player",
]);

export interface FavoriteMetadata {
  /** YYYY-MM-DD, used by Event favorites for silent-expire logic. */
  startDate?: string;
  /** YYYY-MM-DD inclusive. */
  endDate?: string;
  /**
   * Case-insensitive substring matched against `match.leagueName` when the
   * exact `leagueId` check misses. Set automatically by the search route
   * for "container" leagues (e.g. "ATP World Tour" → "ATP") whose own
   * `idLeague` is empty of actual matches because the data sits under
   * per-tournament child league rows.
   */
  leagueNameContains?: string;
}

export const favorites = pgTable(
  "favorites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: favoriteTypeEnum("type").notNull(),
    externalId: text("external_id").notNull(),
    displayName: text("display_name").notNull(),
    sport: text("sport").$type<Sport>().notNull(),
    metadata: jsonb("metadata").$type<FavoriteMetadata>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("favorites_user_type_external_unique").on(
      t.userId,
      t.type,
      t.externalId,
    ),
    index("favorites_user_idx").on(t.userId),
  ],
);

export type FavoriteRow = typeof favorites.$inferSelect;
export type NewFavoriteRow = typeof favorites.$inferInsert;
