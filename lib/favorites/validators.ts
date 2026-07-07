/**
 * Zod schemas for the favorites CRUD API.
 *
 * Validation happens server-side ONLY (the client may build the same shape
 * for ergonomics, but the server must never trust client input). The
 * Validators enforce the spec's "only the four sports / only the four
 * favorite types" rule.
 */

import { z } from "zod";
import { FAVORITE_TYPES, SUPPORTED_SPORTS } from "@/lib/sports/types";

export const favoriteTypeSchema = z.enum(FAVORITE_TYPES);
export const sportSchema = z.enum(SUPPORTED_SPORTS);

export const favoriteMetadataSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    leagueNameContains: z.string().min(1).max(64).optional(),
    leagueKey: z
      .string()
      .regex(/^[a-z]+\/[a-z0-9._-]+$/i)
      .max(64)
      .optional(),
  })
  .strict();

export const createFavoriteSchema = z
  .object({
    type: favoriteTypeSchema,
    externalId: z.string().min(1).max(256),
    displayName: z.string().min(1).max(256),
    sport: sportSchema,
    metadata: favoriteMetadataSchema.optional(),
  })
  .strict();

export type CreateFavoriteInput = z.infer<typeof createFavoriteSchema>;

export const deleteFavoriteParamsSchema = z
  .object({
    id: z.string().min(1).max(64),
  })
  .strict();
