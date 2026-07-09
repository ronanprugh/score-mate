/**
 * Pure logic for the tennis tournament card's staged disclosure (Spec 10).
 *
 * The card starts collapsed, the first activation reveals only the singles
 * sections, and a second activation additionally reveals the doubles/mixed
 * sections. Activating past the final stage wraps back to collapsed. Stages
 * are derived from which families are actually present, so a singles-only or
 * doubles-only tournament has a single expanded stage rather than a dead click.
 */

import type { MatchGroup, SectionKey } from "./tennis-priority";

/** Singles section keys, in display order. */
export const SINGLES_KEYS: readonly SectionKey[] = [
  "mens-singles",
  "womens-singles",
];

/** Doubles/mixed section keys, in display order. */
export const DOUBLES_KEYS: readonly SectionKey[] = [
  "mens-doubles",
  "womens-doubles",
  "mixed-doubles",
];

const FAMILIES: readonly { keys: readonly SectionKey[]; label: string }[] = [
  { keys: SINGLES_KEYS, label: "Singles" },
  { keys: DOUBLES_KEYS, label: "Doubles" },
];

/**
 * The present reveal families, in fixed order (singles first, then doubles),
 * each as its member `MatchGroup`s (already `SECTION_ORDER`-sorted by
 * `groupMatches`). Families with zero matching groups are omitted.
 */
export function revealFamilies(groups: MatchGroup[]): MatchGroup[][] {
  const families: MatchGroup[][] = [];
  for (const { keys } of FAMILIES) {
    const members = groups.filter((g) => keys.includes(g.key));
    if (members.length > 0) families.push(members);
  }
  return families;
}

/**
 * Total number of stages: stage 0 (collapsed) plus one stage per present
 * family. A tournament with no classifiable sections has exactly 1 stage
 * (collapsed only, non-interactive).
 */
export function totalStages(groups: MatchGroup[]): number {
  return 1 + revealFamilies(groups).length;
}

/**
 * Sections visible at the given stage: the cumulative union of families for
 * stages 1..N, empty at stage 0. Stage is clamped into range.
 */
export function sectionsForStage(
  groups: MatchGroup[],
  stage: number,
): MatchGroup[] {
  const families = revealFamilies(groups);
  const n = Math.max(0, Math.min(stage, families.length));
  return families.slice(0, n).flat();
}

/**
 * Advances the stage by one activation, wrapping back to 0 (collapsed) after
 * the final stage.
 */
export function nextStage(groups: MatchGroup[], stage: number): number {
  const stages = totalStages(groups);
  return (stage + 1) % stages;
}

/**
 * Human-readable label for the current stage's revealed families (e.g.
 * `"Singles"`, `"Singles + Doubles"`, or `"Doubles"` for a doubles-only
 * event). Empty at stage 0.
 */
export function stageHint(groups: MatchGroup[], stage: number): string {
  const families = revealFamilies(groups);
  const n = Math.max(0, Math.min(stage, families.length));
  if (n === 0) return "";
  const labels = FAMILIES.filter((f) =>
    families.slice(0, n).some((fam) => fam.some((g) => f.keys.includes(g.key))),
  ).map((f) => f.label);
  return labels.join(" + ");
}
