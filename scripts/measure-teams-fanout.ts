/**
 * Measures the upstream ESPN cost of the Spec 13 competition fan-out.
 *
 * This does NOT reproduce Spec 12's end-to-end `/api/teams` measurement — that
 * was taken against an instrumented production deployment with a signed-in
 * session, which is not reproducible locally. What it does measure is the term
 * that dominates cold latency and the only term this spec changes: the upstream
 * schedule requests for one followed team.
 *
 * Usage: pnpm tsx scripts/measure-teams-fanout.ts [runs]
 */

import { teamScheduleForLeague } from "@/lib/espn/client";
import { teamScheduleAcrossCompetitions } from "@/lib/teams/schedule";

const LIVERPOOL = "364";
const PRIMARY = "soccer/eng.1";
const RUNS = Number(process.argv[2] ?? 5);

/** Wraps fetch to count requests issued during one scenario. */
function countingFetch() {
  let count = 0;
  const fn: typeof fetch = (url, init) => {
    count += 1;
    return fetch(url, init);
  };
  return {
    fetchFn: fn,
    get count() {
      return count;
    },
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

async function time<T>(fn: () => Promise<T>): Promise<[number, T]> {
  const t0 = performance.now();
  const out = await fn();
  return [Math.round(performance.now() - t0), out];
}

async function scenario(
  label: string,
  run: (fetchFn: typeof fetch) => Promise<{ matches: number }>,
) {
  const times: number[] = [];
  const counts: number[] = [];
  let matches = 0;

  for (let i = 0; i < RUNS; i++) {
    const c = countingFetch();
    const [ms, out] = await time(() => run(c.fetchFn));
    times.push(ms);
    counts.push(c.count);
    matches = out.matches;
  }

  console.log(
    `${label.padEnd(38)} median ${String(median(times)).padStart(5)} ms  ` +
      `range ${Math.min(...times)}-${Math.max(...times)} ms  ` +
      `requests ${counts[0]}  matches ${matches}`,
  );
  return { median: median(times), requests: counts[0]!, matches };
}

async function main() {
  console.log(
    `Liverpool (${LIVERPOOL}), primary league ${PRIMARY}, ${RUNS} runs each.`,
  );
  console.log(
    "Every run is a cold upstream fetch — no cache in this harness.\n",
  );

  // BEFORE: what the app did prior to Spec 13 — one league, implicit season.
  await scenario("before: 1 league, implicit season", async (fetchFn) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${PRIMARY}/teams/${LIVERPOOL}/schedule`;
    const res = await fetchFn(url);
    const data = (await res.json()) as { events?: unknown[] | null };
    return { matches: data.events?.length ?? 0 };
  });

  // AFTER, step 1: one league with the season fallback (Task 1.0).
  await scenario("after T1: 1 league + season fallback", async (fetchFn) => {
    const m = await teamScheduleForLeague(PRIMARY, LIVERPOOL, { fetchFn });
    return { matches: m.length };
  });

  // AFTER, step 2: the full competition fan-out (Task 2.0).
  await scenario("after T2: 7 competitions", async (fetchFn) => {
    const { matches } = await teamScheduleAcrossCompetitions(
      PRIMARY,
      LIVERPOOL,
      { fetchFn },
    );
    return { matches: matches.length };
  });

  // The shape /api/teams actually has: Spec 12's 7-entity favorites profile,
  // every entity fanning out concurrently. This is the number the cold budget
  // has to absorb.
  const PROFILE: [string, string, string][] = [
    ["soccer/eng.1", "364", "Liverpool"],
    ["soccer/eng.1", "359", "Arsenal"],
    ["soccer/esp.1", "86", "Real Madrid"],
    ["soccer/ger.1", "132", "Bayern Munich"],
    ["football/nfl", "12", "Chiefs"],
    ["basketball/nba", "13", "Lakers"],
    ["baseball/mlb", "10", "Yankees"],
  ];

  console.log("");
  await scenario("7-entity profile, all concurrent", async (fetchFn) => {
    const results = await Promise.all(
      PROFILE.map(([league, id]) =>
        teamScheduleAcrossCompetitions(league, id, { fetchFn }),
      ),
    );
    return { matches: results.reduce((n, r) => n + r.matches.length, 0) };
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
