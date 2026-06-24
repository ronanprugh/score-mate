/**
 * Operator-run script: regenerate `lib/espn/catalog.json` from ESPN's
 * public per-league teams endpoint.
 *
 * The committed catalog backs the in-memory team/league search on the
 * Favorites screen (`app/api/favorites/search/route.ts`). It's a snapshot,
 * not a live lookup — ESPN team rosters change ~once a year, so a
 * committed JSON is faster, cheaper, fully deterministic in tests, and
 * doesn't add a cold-cache latency cliff on the first search after each
 * deploy.
 *
 * Run quarterly (or after a confirmed league addition):
 *
 *   pnpm tsx scripts/refresh-espn-catalog.ts
 *
 * Dry-run (no file written, prints the planned league list and counts):
 *
 *   pnpm tsx scripts/refresh-espn-catalog.ts --dry-run
 *
 * Output is sorted deterministically:
 *   teams:   by sport, then leagueKey, then numeric id
 *   leagues: by sport, then leagueKey
 *
 * The trailing newline is preserved so the file plays nicely with `git
 * diff` and Prettier's default formatter.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { leagueTeams } from "@/lib/espn/client";
import { SUPPORTED_LEAGUES, type SupportedLeague } from "@/lib/espn/leagues";
import type { League, Team } from "@/lib/sports/types";

interface Catalog {
  generatedAt: string;
  leagues: League[];
  teams: (Team & { leagueKey: string })[];
}

const CATALOG_PATH = resolve(process.cwd(), "lib/espn/catalog.json");

async function fetchLeagueTeams(
  entry: SupportedLeague,
): Promise<
  | { entry: SupportedLeague; teams: Team[] }
  | { entry: SupportedLeague; error: string }
> {
  try {
    const teams = await leagueTeams(entry.leagueKey);
    return { entry, teams };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { entry, error: message };
  }
}

function compareTeams(
  a: Team & { leagueKey: string },
  b: Team & { leagueKey: string },
): number {
  if (a.sport !== b.sport) return (a.sport ?? "").localeCompare(b.sport ?? "");
  if (a.leagueKey !== b.leagueKey)
    return a.leagueKey.localeCompare(b.leagueKey);
  const ai = Number(a.id);
  const bi = Number(b.id);
  if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
  return a.id.localeCompare(b.id);
}

function compareLeagues(a: League, b: League): number {
  if (a.sport !== b.sport) return a.sport.localeCompare(b.sport);
  return a.id.localeCompare(b.id);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(
    `[refresh-espn-catalog] ${SUPPORTED_LEAGUES.length} leagues planned (dry-run=${dryRun})`,
  );
  for (const l of SUPPORTED_LEAGUES) {
    console.log(`  - ${l.leagueKey.padEnd(36)} (${l.sport})`);
  }

  if (dryRun) {
    console.log("[refresh-espn-catalog] dry-run: not fetching, not writing.");
    return;
  }

  const results = await Promise.all(SUPPORTED_LEAGUES.map(fetchLeagueTeams));

  const teams: (Team & { leagueKey: string })[] = [];
  const leagues: League[] = [];
  let errors = 0;

  for (const res of results) {
    if ("error" in res) {
      console.error(`  ✗ ${res.entry.leagueKey}: ${res.error}`);
      errors += 1;
      continue;
    }
    leagues.push({
      id: res.entry.leagueKey,
      name: res.entry.displayName,
      sport: res.entry.sport,
    });
    for (const t of res.teams) {
      teams.push({ ...t, leagueKey: res.entry.leagueKey });
    }
    console.log(`  ✓ ${res.entry.leagueKey}: ${res.teams.length} teams`);
  }

  teams.sort(compareTeams);
  leagues.sort(compareLeagues);

  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    leagues,
    teams,
  };

  await writeFile(
    CATALOG_PATH,
    JSON.stringify(catalog, null, 2) + "\n",
    "utf8",
  );

  console.log(
    `[refresh-espn-catalog] wrote ${CATALOG_PATH}: ${teams.length} teams across ${leagues.length} leagues (errors: ${errors}).`,
  );

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
