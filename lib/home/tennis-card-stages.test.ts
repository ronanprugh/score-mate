import { describe, expect, it } from "vitest";
import type { MatchGroup, SectionKey } from "./tennis-priority";
import {
  primaryFamily,
  revealFamilies,
  secondaryFamily,
} from "./tennis-card-stages";

/** Builds a minimal MatchGroup for a given section key; matches are irrelevant here. */
function group(key: SectionKey, label: string = key): MatchGroup {
  return { key, label, matches: [] };
}

const BOTH_FAMILIES: MatchGroup[] = [
  group("mens-singles", "Men's Singles"),
  group("womens-singles", "Women's Singles"),
  group("mens-doubles", "Men's Doubles"),
  group("womens-doubles", "Women's Doubles"),
  group("mixed-doubles", "Mixed Doubles"),
];

const SINGLES_ONLY: MatchGroup[] = [
  group("mens-singles", "Men's Singles"),
  group("womens-singles", "Women's Singles"),
];

const DOUBLES_ONLY: MatchGroup[] = [
  group("mens-doubles", "Men's Doubles"),
  group("mixed-doubles", "Mixed Doubles"),
];

const NO_SECTIONS: MatchGroup[] = [];

describe("revealFamilies", () => {
  it("both-families: returns [singlesGroups, doublesGroups] in order", () => {
    const families = revealFamilies(BOTH_FAMILIES);
    expect(families).toHaveLength(2);
    expect(families[0]!.map((g) => g.key)).toEqual([
      "mens-singles",
      "womens-singles",
    ]);
    expect(families[1]!.map((g) => g.key)).toEqual([
      "mens-doubles",
      "womens-doubles",
      "mixed-doubles",
    ]);
  });

  it("singles-only: returns a single singles family", () => {
    const families = revealFamilies(SINGLES_ONLY);
    expect(families).toHaveLength(1);
    expect(families[0]!.map((g) => g.key)).toEqual([
      "mens-singles",
      "womens-singles",
    ]);
  });

  it("doubles-only: returns a single doubles family", () => {
    const families = revealFamilies(DOUBLES_ONLY);
    expect(families).toHaveLength(1);
    expect(families[0]!.map((g) => g.key)).toEqual([
      "mens-doubles",
      "mixed-doubles",
    ]);
  });

  it("no sections: returns no families", () => {
    expect(revealFamilies(NO_SECTIONS)).toEqual([]);
  });
});

describe("primaryFamily", () => {
  it("both-families: singles is primary", () => {
    expect(primaryFamily(BOTH_FAMILIES).map((g) => g.key)).toEqual([
      "mens-singles",
      "womens-singles",
    ]);
  });

  it("singles-only: singles is primary", () => {
    expect(primaryFamily(SINGLES_ONLY).map((g) => g.key)).toEqual([
      "mens-singles",
      "womens-singles",
    ]);
  });

  it("doubles-only: doubles is primary (fallback)", () => {
    expect(primaryFamily(DOUBLES_ONLY).map((g) => g.key)).toEqual([
      "mens-doubles",
      "mixed-doubles",
    ]);
  });

  it("no sections: empty", () => {
    expect(primaryFamily(NO_SECTIONS)).toEqual([]);
  });
});

describe("secondaryFamily", () => {
  it("both-families: doubles is secondary", () => {
    expect(secondaryFamily(BOTH_FAMILIES).map((g) => g.key)).toEqual([
      "mens-doubles",
      "womens-doubles",
      "mixed-doubles",
    ]);
  });

  it("singles-only: no secondary", () => {
    expect(secondaryFamily(SINGLES_ONLY)).toEqual([]);
  });

  it("doubles-only: no secondary (doubles is primary, not secondary)", () => {
    expect(secondaryFamily(DOUBLES_ONLY)).toEqual([]);
  });

  it("no sections: no secondary", () => {
    expect(secondaryFamily(NO_SECTIONS)).toEqual([]);
  });
});
