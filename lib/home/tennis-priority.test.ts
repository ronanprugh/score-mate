import { describe, expect, it } from "vitest";
import type { Match, TennisMatchDetail } from "@/lib/sports/types";
import {
  averageSeed,
  classifyDraw,
  compareMatches,
  groupMatches,
  matchPriority,
  priorityOf,
  sideRank,
  SECTION_ORDER,
  UNRANKED_SENTINEL,
} from "./tennis-priority";

/** Builds a Tennis match with the fields the priority logic reads. */
function makeMatch(
  id: string,
  opts: {
    draw?: string;
    homeSeed?: number;
    awaySeed?: number;
    kickoffUtc?: string | null;
    status?: Match["status"];
  } = {},
): Match {
  const tennis: TennisMatchDetail = {
    draw: opts.draw ?? "Men's Singles",
    home: {
      sets: [],
      won: false,
      ...(opts.homeSeed ? { seed: opts.homeSeed } : {}),
    },
    away: {
      sets: [],
      won: false,
      ...(opts.awaySeed ? { seed: opts.awaySeed } : {}),
    },
  };
  return {
    id,
    sport: "Tennis",
    homeTeamId: `${id}-h`,
    homeTeamName: "Home",
    awayTeamId: `${id}-a`,
    awayTeamName: "Away",
    leagueId: "tennis/slam/wimbledon",
    leagueName: "Wimbledon",
    dateUtc: "2026-07-01",
    kickoffUtc:
      opts.kickoffUtc === undefined ? "2026-07-01T13:00:00Z" : opts.kickoffUtc,
    status: opts.status ?? "upcoming",
    tennis,
  };
}

describe("priorityOf (formula + top-100 cap)", () => {
  it("two top players: (1,3) → 5/3", () => {
    expect(priorityOf(1, 3)).toBeCloseTo(5 / 3, 10);
  });

  it("caps the weaker side at 100 when the stronger is top-100: (1,150) → 34", () => {
    expect(priorityOf(1, 150)).toBe(34);
  });

  it("cap applies to an unranked opponent of a top player: (50, 9999) → 200/3", () => {
    expect(priorityOf(50, UNRANKED_SENTINEL)).toBeCloseTo(200 / 3, 10);
  });

  it("no cap when both sides are outside the top 100: (120,150) → 130", () => {
    expect(priorityOf(120, 150)).toBe(130);
  });

  it("both unranked → sentinel", () => {
    expect(priorityOf(UNRANKED_SENTINEL, UNRANKED_SENTINEL)).toBe(
      UNRANKED_SENTINEL,
    );
  });

  it("is symmetric in its arguments", () => {
    expect(priorityOf(3, 1)).toBe(priorityOf(1, 3));
  });
});

describe("averageSeed (doubles rule)", () => {
  it("averages two singles seeds: [5, 200] → 102.5", () => {
    expect(averageSeed([5, 200])).toBe(102.5);
  });

  it("treats a missing partner seed as the sentinel", () => {
    expect(averageSeed([2, undefined])).toBe((2 + UNRANKED_SENTINEL) / 2);
  });

  it("empty input → sentinel", () => {
    expect(averageSeed([])).toBe(UNRANKED_SENTINEL);
  });
});

describe("sideRank / matchPriority", () => {
  it("uses a player's seed, sentinel when unseeded", () => {
    const m = makeMatch("m", { homeSeed: 4 });
    expect(sideRank(m, "home")).toBe(4);
    expect(sideRank(m, "away")).toBe(UNRANKED_SENTINEL);
  });

  it("matchPriority matches priorityOf over the two side ranks", () => {
    const m = makeMatch("m", { homeSeed: 1, awaySeed: 150 });
    expect(matchPriority(m)).toBe(priorityOf(1, 150));
    expect(matchPriority(m)).toBe(34);
  });
});

describe("classifyDraw", () => {
  it("classifies all five main sections", () => {
    expect(classifyDraw("Men's Singles")).toBe("mens-singles");
    expect(classifyDraw("Women's Singles")).toBe("womens-singles");
    expect(classifyDraw("Men's Doubles")).toBe("mens-doubles");
    expect(classifyDraw("Women's Doubles")).toBe("womens-doubles");
    expect(classifyDraw("Mixed Doubles")).toBe("mixed-doubles");
  });

  it("is case-insensitive", () => {
    expect(classifyDraw("WOMEN'S SINGLES")).toBe("womens-singles");
  });

  it("does not misread 'women' as men", () => {
    expect(classifyDraw("Women's Doubles")).toBe("womens-doubles");
  });

  it("excludes juniors, wheelchair, qualifying, and missing draws", () => {
    expect(classifyDraw("Boys' Singles")).toBeNull();
    expect(classifyDraw("Wheelchair Men's Singles")).toBeNull();
    expect(classifyDraw("Men's Qualifying Singles")).toBeNull();
    expect(classifyDraw(undefined)).toBeNull();
    expect(classifyDraw("Something Else")).toBeNull();
  });
});

describe("compareMatches", () => {
  it("orders by priority ascending", () => {
    const strong = makeMatch("strong", { homeSeed: 1, awaySeed: 2 });
    const weak = makeMatch("weak", { homeSeed: 30, awaySeed: 31 });
    expect(compareMatches(strong, weak)).toBeLessThan(0);
  });

  it("breaks ties by earliest kickoff, then id", () => {
    const early = makeMatch("b-id", {
      homeSeed: 5,
      awaySeed: 6,
      kickoffUtc: "2026-07-01T09:00:00Z",
    });
    const late = makeMatch("a-id", {
      homeSeed: 5,
      awaySeed: 6,
      kickoffUtc: "2026-07-01T15:00:00Z",
    });
    expect(compareMatches(early, late)).toBeLessThan(0); // earlier kickoff wins

    const sameTimeA = makeMatch("a-id", {
      homeSeed: 5,
      awaySeed: 6,
      kickoffUtc: "2026-07-01T09:00:00Z",
    });
    const sameTimeB = makeMatch("b-id", {
      homeSeed: 5,
      awaySeed: 6,
      kickoffUtc: "2026-07-01T09:00:00Z",
    });
    expect(compareMatches(sameTimeA, sameTimeB)).toBeLessThan(0); // id tiebreak
  });

  it("sorts a match with a null kickoff last", () => {
    const timed = makeMatch("t", {
      homeSeed: 5,
      awaySeed: 6,
      kickoffUtc: "2026-07-01T09:00:00Z",
    });
    const tbd = makeMatch("u", { homeSeed: 5, awaySeed: 6, kickoffUtc: null });
    expect(compareMatches(timed, tbd)).toBeLessThan(0);
  });
});

describe("groupMatches", () => {
  it("buckets into sections in fixed order, omitting empty ones", () => {
    const groups = groupMatches([
      makeMatch("ws", { draw: "Women's Singles", homeSeed: 1 }),
      makeMatch("ms", { draw: "Men's Singles", homeSeed: 1 }),
      makeMatch("xd", { draw: "Mixed Doubles", homeSeed: 1 }),
    ]);
    // Men's Singles, Women's Singles, Mixed Doubles present in SECTION_ORDER order;
    // Men's/Women's Doubles omitted (empty).
    expect(groups.map((g) => g.key)).toEqual([
      "mens-singles",
      "womens-singles",
      "mixed-doubles",
    ]);
  });

  it("drops unclassifiable matches", () => {
    const groups = groupMatches([
      makeMatch("ok", { draw: "Men's Singles", homeSeed: 1 }),
      makeMatch("junior", { draw: "Boys' Singles", homeSeed: 1 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.matches.map((m) => m.id)).toEqual(["ok"]);
  });

  it("sorts each section by priority", () => {
    const groups = groupMatches([
      makeMatch("weak", { draw: "Men's Singles", homeSeed: 30, awaySeed: 31 }),
      makeMatch("strong", { draw: "Men's Singles", homeSeed: 1, awaySeed: 2 }),
    ]);
    expect(groups[0]!.matches.map((m) => m.id)).toEqual(["strong", "weak"]);
  });

  it("returns [] when nothing is classifiable", () => {
    expect(groupMatches([makeMatch("j", { draw: "Junior Boys" })])).toEqual([]);
  });

  it("labels match SECTION_ORDER", () => {
    const labels = SECTION_ORDER.map((s) => s.label);
    expect(labels).toContain("Men's Singles");
    expect(labels).toContain("Mixed Doubles");
  });
});
