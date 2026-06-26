/**
 * Operator-run script: verifies the two ESPN tennis tour endpoints
 * resolve to HTTP 200, and that every marquee tournament's
 * `espnEventName` is recognized (by checking against a historical date
 * when each tournament was in session).
 *
 * Run:
 *
 *   pnpm tsx scripts/verify-tennis-endpoints.ts
 *
 * The script prints:
 *   - one tour-endpoint probe line per (tour, today)
 *   - one event-name probe line per tournament against a sampled
 *     in-session historical date (so we can confirm `espnEventName`
 *     matches what ESPN actually returns)
 *
 * Re-run after editing the registry.
 */

import {
  MARQUEE_TENNIS_TOURNAMENTS,
  buildTennisTourScoreboardUrl,
} from "@/lib/espn/tennis";

function todayCompact(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function probe(url: string): Promise<{
  status: number;
  ms: number;
  bytes: number;
}> {
  const start = performance.now();
  try {
    const res = await fetch(url);
    const body = await res.text();
    return {
      status: res.status,
      ms: Math.round(performance.now() - start),
      bytes: body.length,
    };
  } catch (e) {
    return {
      status: -1,
      ms: Math.round(performance.now() - start),
      bytes: 0,
    };
  }
}

/**
 * Sample dates when each tournament is in session. Used to verify the
 * `espnEventName` filter matches what ESPN actually returns.
 */
const IN_SESSION_DATES: Record<string, string> = {
  "tennis/slam/australian-open": "2025-01-22",
  "tennis/slam/roland-garros": "2025-06-02",
  "tennis/slam/wimbledon": "2025-06-30",
  "tennis/slam/us-open": "2025-09-02",
  "tennis/atp/indian-wells": "2025-03-12",
  "tennis/atp/miami": "2025-03-26",
  "tennis/atp/monte-carlo": "2025-04-09",
  "tennis/atp/madrid": "2025-04-30",
  "tennis/atp/rome": "2025-05-14",
  "tennis/atp/canada": "2025-08-06",
  "tennis/atp/cincinnati": "2025-08-13",
  "tennis/atp/shanghai": "2025-10-08",
  "tennis/atp/paris": "2025-10-29",
  "tennis/wta/doha": "2025-02-12",
  "tennis/wta/dubai": "2025-02-19",
  "tennis/wta/indian-wells": "2025-03-12",
  "tennis/wta/miami": "2025-03-26",
  "tennis/wta/madrid": "2025-04-30",
  "tennis/wta/rome": "2025-05-14",
  "tennis/wta/canada": "2025-08-06",
  "tennis/wta/cincinnati": "2025-08-13",
  "tennis/wta/wuhan": "2025-10-08",
  "tennis/wta/beijing": "2025-09-25",
};

interface ProbeFinding {
  ok: boolean;
  status: number;
  observedName: string | null;
  matchCount: number;
}

async function probeTournamentName(
  tournamentId: string,
  espnEventName: string,
  tour: "atp" | "wta",
  date: string,
): Promise<ProbeFinding> {
  const url = buildTennisTourScoreboardUrl(tour, date);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        observedName: null,
        matchCount: 0,
      };
    }
    const body = (await res.json()) as {
      events?: { name?: string }[] | null;
    };
    const events = body.events ?? [];
    const match = events.find((e) => e.name === espnEventName);
    return {
      ok: Boolean(match),
      status: 200,
      observedName: match?.name ?? null,
      matchCount: events.filter((e) => e.name === espnEventName).length,
    };
  } catch {
    return { ok: false, status: -1, observedName: null, matchCount: 0 };
  }
}

async function main(): Promise<void> {
  console.log(
    "[verify-tennis-endpoints] step 1 — probing tour-level endpoints with today's date",
  );
  const today =
    todayCompact().slice(0, 4) +
    "-" +
    todayCompact().slice(4, 6) +
    "-" +
    todayCompact().slice(6, 8);
  for (const tour of ["atp", "wta"] as const) {
    const url = buildTennisTourScoreboardUrl(tour, today);
    const r = await probe(url);
    const flag = r.status === 200 ? "✓" : "✗";
    console.log(
      `  ${flag} ${String(r.status).padStart(3)} ${String(r.ms).padStart(5)}ms ${String(r.bytes).padStart(7)}B  tennis/${tour}/scoreboard`,
    );
  }

  console.log(
    "\n[verify-tennis-endpoints] step 2 — probing tournament name filter against historical in-session dates",
  );
  let okCount = 0;
  let failCount = 0;
  for (const t of MARQUEE_TENNIS_TOURNAMENTS) {
    const date = IN_SESSION_DATES[t.id];
    if (!date) {
      console.log(`  ? ---  no historical date sample for ${t.id}; skipping`);
      continue;
    }
    for (const tour of t.tourEndpoints) {
      const finding = await probeTournamentName(
        t.id,
        t.espnEventName,
        tour,
        date,
      );
      const flag = finding.ok ? "✓" : "✗";
      if (finding.ok) okCount++;
      else failCount++;
      console.log(
        `  ${flag} ${String(finding.status).padStart(3)} matches=${String(
          finding.matchCount,
        ).padStart(
          3,
        )}  ${t.id.padEnd(34)} tour=${tour} date=${date} espnEventName="${t.espnEventName}"`,
      );
    }
  }
  console.log(
    `\n[verify-tennis-endpoints] done: ${okCount} tournament/tour pairs matched, ${failCount} failed.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
