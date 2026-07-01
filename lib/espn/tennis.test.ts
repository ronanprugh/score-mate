import { describe, expect, it } from "vitest";
import {
  MARQUEE_TENNIS_TOURNAMENTS,
  buildTennisTourScoreboardUrl,
  findMarqueeTournament,
  tennisScoreboard,
} from "./tennis";
import tennisScoreboardFixture from "./__fixtures__/tennis-scoreboard.json";

const TENNIS_ID_REGEX = /^tennis\/(atp|wta|slam)\/[a-z0-9-]+$/;

describe("MARQUEE_TENNIS_TOURNAMENTS registry", () => {
  it("contains exactly 23 entries (4 Slams + 9 ATP 1000 + 10 WTA 1000)", () => {
    expect(MARQUEE_TENNIS_TOURNAMENTS).toHaveLength(23);
  });

  it("every id matches the tennis/{tour}/{slug} shape", () => {
    for (const t of MARQUEE_TENNIS_TOURNAMENTS) {
      expect(t.id).toMatch(TENNIS_ID_REGEX);
    }
  });

  it("the four Grand Slams are present by id", () => {
    const ids = new Set(MARQUEE_TENNIS_TOURNAMENTS.map((t) => t.id));
    expect(ids.has("tennis/slam/australian-open")).toBe(true);
    expect(ids.has("tennis/slam/roland-garros")).toBe(true);
    expect(ids.has("tennis/slam/wimbledon")).toBe(true);
    expect(ids.has("tennis/slam/us-open")).toBe(true);
  });

  it("counts per tour are 4 Slams / 9 ATP / 10 WTA", () => {
    const byTour = { Slam: 0, ATP: 0, WTA: 0 } as Record<
      "Slam" | "ATP" | "WTA",
      number
    >;
    for (const t of MARQUEE_TENNIS_TOURNAMENTS) byTour[t.tour]++;
    expect(byTour.Slam).toBe(4);
    expect(byTour.ATP).toBe(9);
    expect(byTour.WTA).toBe(10);
  });

  it("Slams fan out to both atp + wta tour endpoints; 1000s hit one", () => {
    for (const t of MARQUEE_TENNIS_TOURNAMENTS) {
      if (t.tour === "Slam") {
        expect([...t.tourEndpoints].sort()).toEqual(["atp", "wta"]);
      } else if (t.tour === "ATP") {
        expect(t.tourEndpoints).toEqual(["atp"]);
      } else {
        expect(t.tourEndpoints).toEqual(["wta"]);
      }
    }
  });

  it("every entry has an espnEventName (used to filter the tour response)", () => {
    for (const t of MARQUEE_TENNIS_TOURNAMENTS) {
      expect(t.espnEventName.length).toBeGreaterThan(0);
    }
  });

  it("findMarqueeTournament returns the entry for a known id and null otherwise", () => {
    expect(findMarqueeTournament("tennis/slam/wimbledon")?.displayName).toBe(
      "Wimbledon",
    );
    expect(findMarqueeTournament("tennis/atp/bogus")).toBeNull();
  });
});

describe("buildTennisTourScoreboardUrl", () => {
  it("encodes the date compactly and targets the right tour", () => {
    expect(buildTennisTourScoreboardUrl("atp", "2026-07-01")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20260701",
    );
    expect(buildTennisTourScoreboardUrl("wta", "2026-07-01")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard?dates=20260701",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* tennisScoreboard                                                           */
/* -------------------------------------------------------------------------- */

interface FixtureCompetition {
  id: string;
  state: "pre" | "in" | "post";
  homeName: string;
  awayName: string;
  homeSets?: number;
  awaySets?: number;
  date?: string;
}

function makeCompetition(c: FixtureCompetition): unknown {
  const buildLs = (n: number, winnerHome: boolean) =>
    Array.from({ length: n }, (_, i) => ({
      value: 6,
      winner: i < (winnerHome ? n : 0),
    }));
  return {
    id: c.id,
    date: c.date ?? "2026-07-01T13:00:00Z",
    status: { type: { state: c.state, shortDetail: "Set 3" } },
    competitors: [
      {
        id: `h-${c.id}`,
        homeAway: "home",
        athlete: { id: `h-${c.id}`, displayName: c.homeName },
        winner: (c.homeSets ?? 0) > (c.awaySets ?? 0),
        linescores:
          c.state === "pre"
            ? []
            : Array.from({ length: c.homeSets ?? 0 }, () => ({
                value: 6,
                winner: true,
              })),
      },
      {
        id: `a-${c.id}`,
        homeAway: "away",
        athlete: { id: `a-${c.id}`, displayName: c.awayName },
        winner: (c.awaySets ?? 0) > (c.homeSets ?? 0),
        linescores:
          c.state === "pre"
            ? []
            : Array.from({ length: c.awaySets ?? 0 }, () => ({
                value: 6,
                winner: true,
              })),
      },
    ],
  };
}

function makeTourResponse(
  events: { name: string; competitions: FixtureCompetition[] }[],
): unknown {
  return {
    events: events.map((e) => ({
      id: e.name,
      name: e.name,
      shortName: e.name,
      groupings: [
        {
          grouping: {
            id: "1",
            slug: "mens-singles",
            displayName: "Men's Singles",
          },
          competitions: e.competitions.map(makeCompetition),
        },
      ],
    })),
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("tennisScoreboard", () => {
  it("returns [] when the tournamentId is unknown", async () => {
    const { matches: result } = await tennisScoreboard(
      "tennis/atp/bogus",
      "2026-07-01",
      {
        fetchFn: async () => jsonResponse({ events: [] }),
      },
    );
    expect(result).toEqual([]);
  });

  it("returns [] when the tour response has no events (dormant date)", async () => {
    const { matches: result } = await tennisScoreboard(
      "tennis/atp/wimbledon",
      "2026-07-01",
      { fetchFn: async () => jsonResponse({ events: null }) },
    );
    expect(result).toEqual([]);
  });

  it("returns [] when the tour response carries events but none match the tournament name", async () => {
    const { matches: result } = await tennisScoreboard(
      "tennis/atp/wimbledon",
      "2026-07-01",
      {
        fetchFn: async () =>
          jsonResponse(
            makeTourResponse([
              {
                name: "Some Other Open",
                competitions: [
                  { id: "x", state: "in", homeName: "A", awayName: "B" },
                ],
              },
            ]),
          ),
      },
    );
    expect(result).toEqual([]);
  });

  it("Slam fans out to atp + wta endpoints and concatenates matches from each", async () => {
    const calls: string[] = [];
    const { matches: result } = await tennisScoreboard(
      "tennis/slam/wimbledon",
      "2026-07-01",
      {
        fetchFn: async (url) => {
          calls.push(String(url));
          const tour = String(url).includes("/atp/") ? "ATP" : "WTA";
          return jsonResponse(
            makeTourResponse([
              {
                name: "Wimbledon",
                competitions: [
                  {
                    id: `${tour}-m1`,
                    state: tour === "ATP" ? "in" : "pre",
                    homeName: `${tour} P1`,
                    awayName: `${tour} P2`,
                    homeSets: tour === "ATP" ? 2 : 0,
                    awaySets: tour === "ATP" ? 1 : 0,
                  },
                ],
              },
            ]),
          );
        },
      },
    );
    expect(calls).toHaveLength(2);
    expect(calls.some((u) => u.includes("/tennis/atp/scoreboard"))).toBe(true);
    expect(calls.some((u) => u.includes("/tennis/wta/scoreboard"))).toBe(true);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["ATP-m1", "WTA-m1"]);
    expect(result[0]!.status).toBe("live");
    expect(result[1]!.status).toBe("upcoming");
    expect(result[0]!.homeScore).toBe(2);
    expect(result[0]!.awayScore).toBe(1);
    expect(result[0]!.sport).toBe("Tennis");
    expect(result[0]!.leagueId).toBe("tennis/slam/wimbledon");
    expect(result[0]!.leagueName).toBe("Wimbledon");
    expect(result[0]!.round).toBe("Men's Singles");
    expect(result[0]!.homeTeamLogo).toBeUndefined();
    expect(result[0]!.awayTeamLogo).toBeUndefined();
  });

  it("dedupes matches when atp + wta responses overlap on the same competition id", async () => {
    // ESPN's atp and wta tennis scoreboards return overlapping events during a
    // Slam, so the same competition id can come back from both endpoints.
    // tennisScoreboard must collapse them to a single Match (otherwise the
    // homepage renders duplicate React keys and the live/done counts double).
    const { matches: result } = await tennisScoreboard(
      "tennis/slam/wimbledon",
      "2026-07-01",
      {
        fetchFn: async () =>
          jsonResponse(
            makeTourResponse([
              {
                name: "Wimbledon",
                competitions: [
                  {
                    id: "177461",
                    state: "in",
                    homeName: "Carlos Alcaraz",
                    awayName: "Jannik Sinner",
                    homeSets: 2,
                    awaySets: 1,
                  },
                ],
              },
            ]),
          ),
      },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("177461");
  });

  it("filters competitions to the requested date (ESPN returns the whole draw)", async () => {
    // ESPN ignores the dates= param and returns every round of the event.
    // tennisScoreboard must keep only competitions on the requested date.
    const { matches: result } = await tennisScoreboard(
      "tennis/atp/indian-wells",
      "2026-03-12",
      {
        fetchFn: async () =>
          jsonResponse(
            makeTourResponse([
              {
                name: "BNP Paribas Open",
                competitions: [
                  {
                    id: "early-round",
                    state: "post",
                    homeName: "A",
                    awayName: "B",
                    date: "2026-03-10T18:00:00Z",
                  },
                  {
                    id: "todays-match",
                    state: "in",
                    homeName: "C",
                    awayName: "D",
                    date: "2026-03-12T18:00:00Z",
                  },
                  {
                    id: "later-round",
                    state: "pre",
                    homeName: "E",
                    awayName: "F",
                    date: "2026-03-14T18:00:00Z",
                  },
                ],
              },
            ]),
          ),
      },
    );
    expect(result.map((m) => m.id)).toEqual(["todays-match"]);
  });

  it("surfaces set scores, tiebreaks, flags, draw, round, court and best-of in match.tennis", async () => {
    const { matches: result } = await tennisScoreboard(
      "tennis/atp/indian-wells",
      "2026-03-12",
      {
        fetchFn: async () =>
          jsonResponse({
            events: [
              {
                name: "BNP Paribas Open",
                groupings: [
                  {
                    grouping: { displayName: "Men's Singles" },
                    competitions: [
                      {
                        id: "rich-1",
                        date: "2026-03-12T18:00:00Z",
                        status: { type: { state: "post" } },
                        type: { text: "Men's Singles" },
                        round: { displayName: "Quarterfinal" },
                        format: { regulation: { periods: 3 } },
                        venue: {
                          fullName: "Indian Wells, USA",
                          court: "Stadium 1",
                        },
                        competitors: [
                          {
                            id: "a",
                            homeAway: "home",
                            winner: true,
                            athlete: {
                              id: "a",
                              displayName: "Carlos Alcaraz",
                              flag: {
                                href: "https://flags/esp.png",
                                alt: "Spain",
                              },
                            },
                            linescores: [
                              { value: 6, winner: true },
                              { value: 7, tiebreak: 5, winner: true },
                            ],
                          },
                          {
                            id: "b",
                            homeAway: "away",
                            winner: false,
                            athlete: {
                              id: "b",
                              displayName: "Jannik Sinner",
                              flag: {
                                href: "https://flags/ita.png",
                                alt: "Italy",
                              },
                            },
                            linescores: [
                              { value: 4, winner: false },
                              { value: 6, tiebreak: 5, winner: false },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
      },
    );
    expect(result).toHaveLength(1);
    const t = result[0]!.tennis!;
    expect(t.bestOf).toBe(3);
    expect(t.draw).toBe("Men's Singles");
    expect(t.round).toBe("Quarterfinal");
    expect(t.court).toBe("Stadium 1");
    expect(t.home.flagAlt).toBe("Spain");
    expect(t.home.flagUrl).toBe("https://flags/esp.png");
    expect(t.home.won).toBe(true);
    expect(t.home.sets).toEqual([
      { games: 6, won: true },
      { games: 7, tiebreak: 5, won: true },
    ]);
    expect(t.away.sets).toEqual([
      { games: 4, won: false },
      { games: 6, tiebreak: 5, won: false },
    ]);
  });

  it("buckets competitions by local date (tz), not raw UTC", async () => {
    // 01:30 UTC on Jul 2 is the evening of Jul 1 in America/New_York (EDT, -4).
    const fetchFn = async () =>
      jsonResponse(
        makeTourResponse([
          {
            name: "Wimbledon",
            competitions: [
              {
                id: "late",
                state: "in",
                homeName: "A",
                awayName: "B",
                date: "2026-07-02T01:30:00Z",
              },
            ],
          },
        ]),
      );

    // In New York the match belongs to Jul 1.
    const ny1 = await tennisScoreboard("tennis/slam/wimbledon", "2026-07-01", {
      fetchFn,
      tz: "America/New_York",
    });
    expect(ny1.matches.map((m) => m.id)).toEqual(["late"]);

    // ...and NOT to Jul 2 in New York.
    const ny2 = await tennisScoreboard("tennis/slam/wimbledon", "2026-07-02", {
      fetchFn,
      tz: "America/New_York",
    });
    expect(ny2.matches).toEqual([]);

    // Under UTC (default) the same match lands on Jul 2.
    const utc = await tennisScoreboard("tennis/slam/wimbledon", "2026-07-02", {
      fetchFn,
    });
    expect(utc.matches.map((m) => m.id)).toEqual(["late"]);
  });

  it("buckets correctly across the date line (Pacific/Auckland, +12)", async () => {
    // 13:00 UTC on Jun 30 is 01:00 on Jul 1 in Auckland (NZST, +12).
    const fetchFn = async () =>
      jsonResponse(
        makeTourResponse([
          {
            name: "Wimbledon",
            competitions: [
              {
                id: "akl",
                state: "in",
                homeName: "A",
                awayName: "B",
                date: "2026-06-30T13:00:00Z",
              },
            ],
          },
        ]),
      );

    const jul1 = await tennisScoreboard("tennis/slam/wimbledon", "2026-07-01", {
      fetchFn,
      tz: "Pacific/Auckland",
    });
    expect(jul1.matches.map((m) => m.id)).toEqual(["akl"]);

    const jun30 = await tennisScoreboard(
      "tennis/slam/wimbledon",
      "2026-06-30",
      {
        fetchFn,
        tz: "Pacific/Auckland",
      },
    );
    expect(jun30.matches).toEqual([]);
  });

  it("returns the tournament's overall draw span across all rounds", async () => {
    const fetchFn = async () =>
      jsonResponse(
        makeTourResponse([
          {
            name: "BNP Paribas Open",
            competitions: [
              {
                id: "r1",
                state: "post",
                homeName: "A",
                awayName: "B",
                date: "2026-03-08T18:00:00Z",
              },
              {
                id: "today",
                state: "in",
                homeName: "C",
                awayName: "D",
                date: "2026-03-12T18:00:00Z",
              },
              {
                id: "r3",
                state: "pre",
                homeName: "E",
                awayName: "F",
                date: "2026-03-15T18:00:00Z",
              },
            ],
          },
        ]),
      );

    const res = await tennisScoreboard(
      "tennis/atp/indian-wells",
      "2026-03-12",
      {
        fetchFn,
      },
    );
    // Span covers the whole draw; matches are filtered to the requested day.
    expect(res.eventStartDate).toBe("2026-03-08");
    expect(res.eventEndDate).toBe("2026-03-15");
    expect(res.matches.map((m) => m.id)).toEqual(["today"]);
  });

  it("ATP 1000 hits the atp endpoint only and uses athlete display names", async () => {
    const calls: string[] = [];
    const { matches: result } = await tennisScoreboard(
      "tennis/atp/indian-wells",
      "2026-03-10",
      {
        fetchFn: async (url) => {
          calls.push(String(url));
          return jsonResponse(
            makeTourResponse([
              {
                name: "BNP Paribas Open",
                competitions: [
                  {
                    id: "iw-1",
                    state: "post",
                    homeName: "Carlos Alcaraz",
                    awayName: "Jannik Sinner",
                    homeSets: 2,
                    awaySets: 1,
                    date: "2026-03-10T18:00:00Z",
                  },
                ],
              },
            ]),
          );
        },
      },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/tennis/atp/scoreboard");
    expect(result).toHaveLength(1);
    expect(result[0]!.homeTeamName).toBe("Carlos Alcaraz");
    expect(result[0]!.awayTeamName).toBe("Jannik Sinner");
    expect(result[0]!.status).toBe("final");
    expect(result[0]!.sport).toBe("Tennis");
  });

  it("encodes the date compactly into every URL", async () => {
    const calls: string[] = [];
    await tennisScoreboard("tennis/slam/wimbledon", "2026-07-01", {
      fetchFn: async (url) => {
        calls.push(String(url));
        return jsonResponse({ events: [] });
      },
    });
    for (const url of calls) expect(url).toContain("dates=20260701");
  });

  it("parses the tournament seed from curatedRank.current, leaving it undefined when unseeded", async () => {
    // Spec 08 T1.0: the ESPN scoreboard exposes no world ranking — only
    // competitor.curatedRank.current (the tournament seed). Verified against a
    // committed sample of the real payload shape.
    const { matches } = await tennisScoreboard(
      "tennis/atp/indian-wells",
      "2026-03-12",
      { fetchFn: async () => jsonResponse(tennisScoreboardFixture) },
    );

    const seededVsSeeded = matches.find((m) => m.id === "seeded-vs-seeded")!;
    expect(seededVsSeeded.tennis!.home.seed).toBe(1);
    expect(seededVsSeeded.tennis!.away.seed).toBe(4);

    const seededVsUnseeded = matches.find(
      (m) => m.id === "seeded-vs-unseeded",
    )!;
    expect(seededVsUnseeded.tennis!.home.seed).toBe(5);
    // Unseeded competitor has no curatedRank → seed stays undefined (no sentinel
    // at the parse layer).
    expect(seededVsUnseeded.tennis!.away.seed).toBeUndefined();
  });
});
