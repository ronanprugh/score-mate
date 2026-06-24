import { describe, expect, it } from "vitest";
import { matchFavoritesAgainstMatches } from "./favorite-matcher";
import type { Favorite, Match } from "./sportsdb/types";

function makeMatch(overrides: Partial<Match> & Pick<Match, "id">): Match {
  return {
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: "Home",
    awayTeamId: "a",
    awayTeamName: "Away",
    leagueId: "0000",
    leagueName: "Some League",
    dateUtc: "2026-06-22",
    kickoffUtc: "2026-06-22T15:00:00",
    status: "upcoming",
    ...overrides,
  };
}

function fav(overrides: Partial<Favorite> & Pick<Favorite, "type">): Favorite {
  return {
    id: "fav-id",
    userId: "user-1",
    externalId: "ext",
    displayName: "Display",
    sport: "Soccer",
    metadata: null,
    ...overrides,
  };
}

describe("favorite-matcher: Team favorites", () => {
  it("matches a team that is the HOME side", () => {
    const matches = [
      makeMatch({ id: "m1", homeTeamId: "team-usa" }),
      makeMatch({ id: "m2", awayTeamId: "team-usa" }), // same favorite, away
      makeMatch({ id: "m3", homeTeamId: "other", awayTeamId: "other" }),
    ];
    const out = matchFavoritesAgainstMatches(
      [fav({ type: "team", externalId: "team-usa" })],
      matches,
    );
    expect(out.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});

describe("favorite-matcher: Sport favorites (allowlist-bounded)", () => {
  it("matches a Premier League match for a Sport=Soccer favorite", () => {
    const matches = [
      makeMatch({
        id: "m1",
        sport: "Soccer",
        leagueId: "4328",
        leagueName: "English Premier League",
      }),
    ];
    const out = matchFavoritesAgainstMatches(
      [fav({ type: "sport", sport: "Soccer", externalId: "Soccer" })],
      matches,
    );
    expect(out.map((m) => m.id)).toEqual(["m1"]);
  });

  it("REJECTS a non-allowlist league (EFL Championship) for Sport=Soccer (closes audit finding F2)", () => {
    const matches = [
      makeMatch({
        id: "m1",
        sport: "Soccer",
        leagueId: "4396",
        leagueName: "English League Championship",
      }),
    ];
    const out = matchFavoritesAgainstMatches(
      [fav({ type: "sport", sport: "Soccer", externalId: "Soccer" })],
      matches,
    );
    // The bug guarded against: Sport favorites silently broadening into
    // "all matches in sport" if the allowlist gate is dropped.
    expect(out).toEqual([]);
  });

  it("rejects a Soccer match when the favorite's sport is Basketball", () => {
    const matches = [
      makeMatch({
        id: "m1",
        sport: "Soccer",
        leagueId: "4328",
        leagueName: "English Premier League",
      }),
    ];
    const out = matchFavoritesAgainstMatches(
      [fav({ type: "sport", sport: "Basketball", externalId: "Basketball" })],
      matches,
    );
    expect(out).toEqual([]);
  });
});

describe("favorite-matcher: League favorites", () => {
  it("matches any match in the favorited league", () => {
    const matches = [
      makeMatch({ id: "m1", leagueId: "4328" }),
      makeMatch({ id: "m2", leagueId: "4335" }),
    ];
    const out = matchFavoritesAgainstMatches(
      [fav({ type: "league", externalId: "4328" })],
      matches,
    );
    expect(out.map((m) => m.id)).toEqual(["m1"]);
  });
});

describe("favorite-matcher: Event favorites (silent-expire)", () => {
  const wcMatch = (id: string, date: string): Match =>
    makeMatch({
      id,
      sport: "Soccer",
      eventInstanceId: "wc-2026",
      leagueId: "4429",
      leagueName: "FIFA World Cup",
      dateUtc: date,
    });

  it("matches a match inside the event window", () => {
    const out = matchFavoritesAgainstMatches(
      [
        fav({
          type: "event",
          externalId: "wc-2026",
          metadata: { startDate: "2026-06-01", endDate: "2026-07-15" },
        }),
      ],
      [wcMatch("m1", "2026-06-22")],
    );
    expect(out.map((m) => m.id)).toEqual(["m1"]);
  });

  it("does NOT match a match after the event window (silent-expire)", () => {
    const out = matchFavoritesAgainstMatches(
      [
        fav({
          type: "event",
          externalId: "wc-2022",
          metadata: { startDate: "2022-11-20", endDate: "2022-12-18" },
        }),
      ],
      [
        // World Cup 2026 game labeled with the 2022 favorite's externalId
        // would never happen in practice (different idEvent), but make sure
        // dates alone protect us if the eventInstanceId ever collides.
        wcMatch("m1", "2026-06-22"),
      ],
    );
    expect(out).toEqual([]);
  });

  it("does NOT match when the metadata window is missing entirely", () => {
    const out = matchFavoritesAgainstMatches(
      [fav({ type: "event", externalId: "wc-2026", metadata: null })],
      [wcMatch("m1", "2026-06-22")],
    );
    // Better to miss than to surface stale matches under an expired favorite.
    expect(out).toEqual([]);
  });
});

describe("favorite-matcher: dedup", () => {
  it("a match claimed by multiple favorites appears exactly once, preserving order", () => {
    const matches = [
      // m1 is matched by all three favorites: Team (team-usa) + League (4328) + Sport-via-allowlist (Premier League).
      makeMatch({
        id: "m1",
        sport: "Soccer",
        homeTeamId: "team-usa",
        leagueId: "4328",
        leagueName: "English Premier League",
      }),
      // m2 is in an out-of-allowlist league and isn't otherwise favorited — should NOT appear in the output.
      makeMatch({
        id: "m2",
        sport: "Soccer",
        leagueId: "4396",
        leagueName: "English League Championship",
      }),
    ];
    const favorites: Favorite[] = [
      fav({ type: "team", externalId: "team-usa" }),
      fav({ id: "fav-2", type: "league", externalId: "4328" }),
      fav({
        id: "fav-3",
        type: "sport",
        sport: "Soccer",
        externalId: "Soccer",
      }),
    ];
    const out = matchFavoritesAgainstMatches(favorites, matches);
    // m1 appears exactly once despite being claimed by all three favorites.
    expect(out.map((m) => m.id)).toEqual(["m1"]);
  });

  it("returns empty when no favorite claims any match", () => {
    const out = matchFavoritesAgainstMatches(
      [fav({ type: "team", externalId: "no-such-team" })],
      [makeMatch({ id: "m1" })],
    );
    expect(out).toEqual([]);
  });

  it("league favorite with metadata.leagueNameContains matches by substring (case-insensitive)", () => {
    const matches = [
      makeMatch({
        id: "wimbledon-m1",
        sport: "Tennis",
        leagueId: "child-tournament-id",
        leagueName: "ATP Wimbledon — Men's Singles",
      }),
      makeMatch({
        id: "wta-m1",
        sport: "Tennis",
        leagueId: "wta-child",
        leagueName: "WTA Eastbourne",
      }),
      makeMatch({
        id: "soccer-m1",
        sport: "Soccer",
        leagueId: "999",
        leagueName: "Some random league",
      }),
    ];
    const atpFav = fav({
      id: "atp-tour-fav",
      type: "league",
      sport: "Tennis",
      externalId: "atp-tour-id",
      displayName: "ATP World Tour",
      metadata: { leagueNameContains: "ATP" },
    });
    const out = matchFavoritesAgainstMatches([atpFav], matches);
    expect(out.map((m) => m.id)).toEqual(["wimbledon-m1"]);
  });

  it("known container league displayName falls back to its built-in substring when metadata is null (back-compat for already-saved favorites)", () => {
    const matches = [
      makeMatch({
        id: "wta-grass",
        sport: "Tennis",
        leagueId: "child-wta-bad-homburg",
        leagueName: "WTA Bad Homburg Open",
      }),
    ];
    const wtaFavWithoutMetadata = fav({
      id: "wta-tour-fav",
      type: "league",
      sport: "Tennis",
      externalId: "wta-tour-id",
      displayName: "WTA World Tour",
      metadata: null,
    });
    const out = matchFavoritesAgainstMatches([wtaFavWithoutMetadata], matches);
    expect(out.map((m) => m.id)).toEqual(["wta-grass"]);
  });

  it("league favorite still prefers exact leagueId when both could match", () => {
    const m = makeMatch({
      id: "exact",
      sport: "Soccer",
      leagueId: "4328",
      leagueName: "English Premier League",
    });
    const fav1 = fav({
      type: "league",
      externalId: "4328",
      displayName: "English Premier League",
    });
    const out = matchFavoritesAgainstMatches([fav1], [m]);
    expect(out.map((x) => x.id)).toEqual(["exact"]);
  });
});
