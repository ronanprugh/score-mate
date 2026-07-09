/**
 * Pure logic for the tennis tournament card's staged disclosure (Spec 10,
 * revised): the card starts collapsed; a single header toggle reveals the
 * primary family (singles, or doubles when no singles exist) and collapses
 * it again. When a secondary (doubles) family exists alongside singles, it
 * is revealed independently via a "see doubles matches" control rather than
 * a second header activation.
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

const FAMILY_KEYS: readonly (readonly SectionKey[])[] = [
  SINGLES_KEYS,
  DOUBLES_KEYS,
];

/**
 * The present reveal families, in fixed order (singles first, then doubles),
 * each as its member `MatchGroup`s (already `SECTION_ORDER`-sorted by
 * `groupMatches`). Families with zero matching groups are omitted, so the
 * result has 0, 1, or 2 entries.
 */
export function revealFamilies(groups: MatchGroup[]): MatchGroup[][] {
  const families: MatchGroup[][] = [];
  for (const keys of FAMILY_KEYS) {
    const members = groups.filter((g) => keys.includes(g.key));
    if (members.length > 0) families.push(members);
  }
  return families;
}

/**
 * The family the header toggle reveals: singles if present, otherwise
 * doubles (for a doubles-only tournament), otherwise empty.
 */
export function primaryFamily(groups: MatchGroup[]): MatchGroup[] {
  return revealFamilies(groups)[0] ?? [];
}

/**
 * The doubles family, only returned when it is a *secondary* reveal (i.e.
 * singles is the primary family and doubles also exists). Empty for
 * doubles-only or singles-only tournaments, where doubles is either the
 * primary family or absent.
 */
export function secondaryFamily(groups: MatchGroup[]): MatchGroup[] {
  const families = revealFamilies(groups);
  return families.length > 1 ? families[1]! : [];
}
