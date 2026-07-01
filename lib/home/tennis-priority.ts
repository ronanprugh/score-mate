/**
 * Pure logic for the tennis discipline/gender grouping feature (Spec 08).
 *
 * Responsibilities (no React, no I/O):
 *  - Classify a match into one of five discipline/gender sections from its draw.
 *  - Compute each side's ranking (seed-based) and a match's priority score.
 *  - Order and group a tournament's matches for the UI.
 *
 * Ranking input is the ESPN tournament **seed** (`TennisPlayerLine.seed`), the
 * only ranking signal ESPN's scoreboard exposes (see Spec 08 Unit 1). Lower is
 * better; a missing seed is treated as `UNRANKED_SENTINEL`.
 */

import type { Match } from "@/lib/sports/types";

/** Seed value used when a player is unseeded (no ESPN `curatedRank`). */
export const UNRANKED_SENTINEL = 9999;
/** Matches shown per section before "Show more" is needed. */
export const INITIAL_VISIBLE = 5;
/** Additional matches revealed per "Show more" activation. */
export const SHOW_MORE_STEP = 5;

export type SectionKey =
  | "mens-singles"
  | "womens-singles"
  | "mens-doubles"
  | "womens-doubles"
  | "mixed-doubles";

/** Fixed display order + labels for the five sections. */
export const SECTION_ORDER: readonly { key: SectionKey; label: string }[] = [
  { key: "mens-singles", label: "Men's Singles" },
  { key: "womens-singles", label: "Women's Singles" },
  { key: "mens-doubles", label: "Men's Doubles" },
  { key: "womens-doubles", label: "Women's Doubles" },
  { key: "mixed-doubles", label: "Mixed Doubles" },
];

/**
 * Draws that are out of scope for the five main sections (juniors, wheelchair,
 * qualifying, exhibitions). Matched case-insensitively as substrings.
 */
const EXCLUDED_DRAW_TERMS = [
  "wheelchair",
  "junior",
  "boys",
  "girls",
  "qualif",
  "invitation",
  "legend",
  "exhibition",
];

/**
 * Classifies a match into a section from `tennis.draw` (e.g. "Men's Singles",
 * "Mixed Doubles"). Returns `null` for missing or out-of-scope draws.
 *
 * Note the ordering trap: the substring "women" contains "men", so gender is
 * resolved women-first.
 */
export function classifyDraw(draw: string | undefined): SectionKey | null {
  if (!draw) return null;
  const s = draw.toLowerCase();
  if (EXCLUDED_DRAW_TERMS.some((w) => s.includes(w))) return null;

  const isDoubles = s.includes("doubles");
  const isSingles = s.includes("singles");
  const isMixed = s.includes("mixed");
  const isWomen = s.includes("women") || s.includes("ladies");
  const isMen = !isWomen && s.includes("men");

  if (isMixed) return isDoubles ? "mixed-doubles" : null;
  if (isSingles && isMen) return "mens-singles";
  if (isSingles && isWomen) return "womens-singles";
  if (isDoubles && isMen) return "mens-doubles";
  if (isDoubles && isWomen) return "womens-doubles";
  return null;
}

/**
 * Arithmetic mean of the given seeds, treating any missing seed as the
 * sentinel. Empty input yields the sentinel. This encodes the doubles/mixed
 * "average of partners' singles seeds" rule; ESPN's scoreboard currently
 * exposes one (team) seed per side, so a doubles side reduces to that seed
 * until per-partner seeds become available.
 */
export function averageSeed(seeds: (number | undefined)[]): number {
  if (seeds.length === 0) return UNRANKED_SENTINEL;
  const vals = seeds.map((x) => x ?? UNRANKED_SENTINEL);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** One side's ranking input for the priority formula. */
export function sideRank(match: Match, side: "home" | "away"): number {
  const line = side === "home" ? match.tennis?.home : match.tennis?.away;
  return averageSeed([line?.seed]);
}

/**
 * Match priority from two side rankings: `(bestRank*2 + adjustedSecond) / 3`,
 * where the weaker side is capped at 100 only when the stronger side is inside
 * the top 100. Lower result = higher priority (shown first).
 */
export function priorityOf(rankA: number, rankB: number): number {
  const best = Math.min(rankA, rankB);
  const other = Math.max(rankA, rankB);
  const adjustedSecond = best <= 100 ? Math.min(100, other) : other;
  return (best * 2 + adjustedSecond) / 3;
}

/** Priority score for a match (lower = shown first). */
export function matchPriority(match: Match): number {
  return priorityOf(sideRank(match, "home"), sideRank(match, "away"));
}

/**
 * Orders matches within a section: priority ascending, then earliest kickoff
 * (nulls last), then match id.
 */
export function compareMatches(a: Match, b: Match): number {
  const pa = matchPriority(a);
  const pb = matchPriority(b);
  if (pa !== pb) return pa - pb;

  const ka = a.kickoffUtc;
  const kb = b.kickoffUtc;
  if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
  if (ka && !kb) return -1;
  if (!ka && kb) return 1;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface MatchGroup {
  key: SectionKey;
  label: string;
  matches: Match[];
}

/**
 * Classifies, drops unclassifiable matches, sorts each section by
 * {@link compareMatches}, and returns only non-empty sections in
 * {@link SECTION_ORDER}.
 */
export function groupMatches(matches: Match[]): MatchGroup[] {
  const buckets = new Map<SectionKey, Match[]>();
  for (const m of matches) {
    const key = classifyDraw(m.tennis?.draw);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(m);
    else buckets.set(key, [m]);
  }

  const out: MatchGroup[] = [];
  for (const { key, label } of SECTION_ORDER) {
    const ms = buckets.get(key);
    if (ms && ms.length > 0) {
      out.push({ key, label, matches: [...ms].sort(compareMatches) });
    }
  }
  return out;
}
