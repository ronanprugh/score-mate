/**
 * /api/favorites/[id]
 *
 *   DELETE → remove one favorite owned by the current user.
 *
 * Returns:
 *   - 401 when there is no session.
 *   - 400 when the id param is missing or malformed.
 *   - 204 when a row owned by the calling user is deleted.
 *   - 404 when the id doesn't exist OR is owned by a different user
 *     (the caller cannot distinguish — by design, for IDOR protection).
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { deleteFavorite } from "@/lib/favorites/queries";
import { deleteFavoriteParamsSchema } from "@/lib/favorites/validators";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let params;
  try {
    params = deleteFavoriteParamsSchema.parse(await ctx.params);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_params", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const deleted = await deleteFavorite(session.user.id, params.id);
  if (!deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
