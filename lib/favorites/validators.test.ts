import { describe, expect, it } from "vitest";
import {
  createFavoriteSchema,
  deleteFavoriteParamsSchema,
  favoriteTypeSchema,
  sportSchema,
} from "./validators";

describe("favoriteTypeSchema", () => {
  it.each(["team", "sport", "league", "event"])("accepts %s", (t) => {
    expect(favoriteTypeSchema.parse(t)).toBe(t);
  });

  it.each(["TEAM", "favorite", "player", "", null, 42])("rejects %p", (bad) => {
    expect(() => favoriteTypeSchema.parse(bad)).toThrow();
  });
});

describe("sportSchema", () => {
  it.each(["Soccer", "American Football", "Basketball", "Baseball"])(
    "accepts %s",
    (s) => {
      expect(sportSchema.parse(s)).toBe(s);
    },
  );

  it.each(["Hockey", "soccer", "MMA", "Tennis"])("rejects %s", (bad) => {
    expect(() => sportSchema.parse(bad)).toThrow();
  });
});

describe("createFavoriteSchema", () => {
  const valid = {
    type: "team" as const,
    externalId: "133604",
    displayName: "Arsenal",
    sport: "Soccer" as const,
  };

  it("accepts a minimal valid Team favorite", () => {
    expect(createFavoriteSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an Event favorite with metadata window", () => {
    const parsed = createFavoriteSchema.parse({
      ...valid,
      type: "event",
      metadata: { startDate: "2026-06-01", endDate: "2026-07-15" },
    });
    expect(parsed.metadata).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-07-15",
    });
  });

  it("rejects an unknown type", () => {
    expect(() =>
      createFavoriteSchema.parse({ ...valid, type: "player" }),
    ).toThrow();
  });

  it("rejects an unknown sport", () => {
    expect(() =>
      createFavoriteSchema.parse({ ...valid, sport: "Hockey" }),
    ).toThrow();
  });

  it("rejects an empty externalId", () => {
    expect(() =>
      createFavoriteSchema.parse({ ...valid, externalId: "" }),
    ).toThrow();
  });

  it("rejects an empty displayName", () => {
    expect(() =>
      createFavoriteSchema.parse({ ...valid, displayName: "" }),
    ).toThrow();
  });

  it("rejects an unknown extra field (strict mode)", () => {
    expect(() =>
      createFavoriteSchema.parse({
        ...valid,
        secretFlag: true,
      } as unknown),
    ).toThrow();
  });

  it("rejects badly-formatted metadata dates", () => {
    expect(() =>
      createFavoriteSchema.parse({
        ...valid,
        metadata: { startDate: "06/01/2026" },
      }),
    ).toThrow();
  });
});

describe("deleteFavoriteParamsSchema", () => {
  it("accepts a non-empty id", () => {
    expect(deleteFavoriteParamsSchema.parse({ id: "abc-123" })).toEqual({
      id: "abc-123",
    });
  });

  it("rejects empty id", () => {
    expect(() => deleteFavoriteParamsSchema.parse({ id: "" })).toThrow();
  });

  it("rejects extra fields", () => {
    expect(() =>
      deleteFavoriteParamsSchema.parse({
        id: "abc",
        admin: true,
      } as unknown),
    ).toThrow();
  });
});
