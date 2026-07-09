import { describe, expect, it } from "vitest";
import type { MatchGroup, SectionKey } from "./tennis-priority";
import {
  nextStage,
  revealFamilies,
  sectionsForStage,
  stageHint,
  totalStages,
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

describe("totalStages", () => {
  it("both-families: 3 stages (collapsed, singles, singles+doubles)", () => {
    expect(totalStages(BOTH_FAMILIES)).toBe(3);
  });

  it("singles-only: 2 stages", () => {
    expect(totalStages(SINGLES_ONLY)).toBe(2);
  });

  it("doubles-only: 2 stages", () => {
    expect(totalStages(DOUBLES_ONLY)).toBe(2);
  });

  it("no sections: 1 stage (collapsed only)", () => {
    expect(totalStages(NO_SECTIONS)).toBe(1);
  });
});

describe("sectionsForStage", () => {
  it("both-families stage 0: empty", () => {
    expect(sectionsForStage(BOTH_FAMILIES, 0)).toEqual([]);
  });

  it("both-families stage 1: singles keys only, doubles withheld", () => {
    const keys = sectionsForStage(BOTH_FAMILIES, 1).map((g) => g.key);
    expect(keys).toEqual(["mens-singles", "womens-singles"]);
  });

  it("both-families stage 2: singles + doubles, in SECTION_ORDER", () => {
    const keys = sectionsForStage(BOTH_FAMILIES, 2).map((g) => g.key);
    expect(keys).toEqual([
      "mens-singles",
      "womens-singles",
      "mens-doubles",
      "womens-doubles",
      "mixed-doubles",
    ]);
  });

  it("doubles-only stage 1: shows doubles sections directly", () => {
    const keys = sectionsForStage(DOUBLES_ONLY, 1).map((g) => g.key);
    expect(keys).toEqual(["mens-doubles", "mixed-doubles"]);
  });
});

describe("nextStage (advance + wrap)", () => {
  it("both-families: 0 -> 1 -> 2 -> 0 (wrap to collapsed)", () => {
    let stage = 0;
    stage = nextStage(BOTH_FAMILIES, stage);
    expect(stage).toBe(1);
    stage = nextStage(BOTH_FAMILIES, stage);
    expect(stage).toBe(2);
    stage = nextStage(BOTH_FAMILIES, stage);
    expect(stage).toBe(0);
  });

  it("singles-only: 0 -> 1 -> 0", () => {
    expect(nextStage(SINGLES_ONLY, 0)).toBe(1);
    expect(nextStage(SINGLES_ONLY, 1)).toBe(0);
  });

  it("no sections: 0 -> 0 (always collapsed)", () => {
    expect(nextStage(NO_SECTIONS, 0)).toBe(0);
  });
});

describe("stageHint", () => {
  it("both-families: '' at 0, 'Singles' at 1, 'Singles + Doubles' at 2", () => {
    expect(stageHint(BOTH_FAMILIES, 0)).toBe("");
    expect(stageHint(BOTH_FAMILIES, 1)).toBe("Singles");
    expect(stageHint(BOTH_FAMILIES, 2)).toBe("Singles + Doubles");
  });

  it("doubles-only: 'Doubles' at stage 1", () => {
    expect(stageHint(DOUBLES_ONLY, 1)).toBe("Doubles");
  });

  it("no sections: '' at stage 0", () => {
    expect(stageHint(NO_SECTIONS, 0)).toBe("");
  });
});
