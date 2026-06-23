/**
 * /api/favorites
 *
 *   GET  → list the current user's favorites (200 + JSON array).
 *   POST → create one favorite (200 + JSON; duplicate returns existing).
 *
 * All requests require a valid Auth.js session. Writes are rate-limited
 * per-user (60 / minute by default). POST input is validated server-side
 * with the strict Zod schema from `lib/favorites/validators.ts`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createFavorite, listFavoritesForUser } from "@/lib/favorites/queries";
import { createFavoriteSchema } from "@/lib/favorites/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await listFavoritesForUser(session.user.id);
  return NextResponse.json({ favorites: rows }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`${session.user.id}:favorites:write`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetMs: limit.resetMs },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.resetMs / 1000)),
        },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let input;
  try {
    input = createFavoriteSchema.parse(payload);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_payload", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const { row, existed } = await createFavorite(session.user.id, input);
  return NextResponse.json(
    { favorite: row, existed },
    { status: existed ? 200 : 201 },
  );
}
