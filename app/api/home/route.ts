/**
 * GET /api/home?dates=<yesterday>,<today>,<tomorrow>
 *
 * The score-tracker homepage's data endpoint. The client computes the
 * three `YYYY-MM-DD` dates in the user's local browser timezone (per
 * `lib/date-window.ts`) and sends them inline. The server NEVER assumes
 * a timezone — it just trusts the client-supplied date strings.
 *
 * Auth-gated.
 *
 * Response shape:
 *   {
 *     yesterday: Match[],
 *     today:     Match[],
 *     tomorrow:  Match[],
 *     source:    { ok: boolean, errors: string[] }
 *   }
 *
 * Partial failures (some sports/leagues succeed, others fail) return 200
 * with `source.ok = false` — the homepage UI shows a banner plus whatever
 * data did load.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { aggregateMatchesForUser } from "@/lib/home/aggregator";
import { makeCachedFetchers } from "@/lib/home/cache";
import { withServerTiming } from "@/lib/perf/server-timing";
import type { DateWindow } from "@/lib/date-window";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the client-supplied IANA timezone if it's a valid one Intl can
 * resolve, otherwise falls back to "UTC". We must not trust an arbitrary
 * string in `Intl.DateTimeFormat({ timeZone })` because invalid values
 * throw at format time.
 */
function parseTimezone(raw: string | null): string {
  if (!raw) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: raw });
    return raw;
  } catch {
    return "UTC";
  }
}

function parseDates(raw: string | null): DateWindow | null {
  if (!raw) return null;
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length !== 3) return null;
  const [yesterday, today, tomorrow] = parts;
  if (
    !yesterday ||
    !today ||
    !tomorrow ||
    !DATE_RE.test(yesterday) ||
    !DATE_RE.test(today) ||
    !DATE_RE.test(tomorrow)
  ) {
    return null;
  }
  return { yesterday, today, tomorrow };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dates = parseDates(searchParams.get("dates"));
  if (!dates) {
    return NextResponse.json(
      {
        error: "invalid_dates",
        hint: "?dates=YYYY-MM-DD,YYYY-MM-DD,YYYY-MM-DD (yesterday,today,tomorrow)",
      },
      { status: 400 },
    );
  }

  const tz = parseTimezone(searchParams.get("tz"));
  const userId = session.user.id;

  const counters: Record<string, number> = {};
  return withServerTiming("home", counters, async () => {
    const envelope = await aggregateMatchesForUser(
      userId,
      dates,
      makeCachedFetchers(dates),
      tz,
      counters,
    );
    return NextResponse.json(envelope, { status: 200 });
  });
}
