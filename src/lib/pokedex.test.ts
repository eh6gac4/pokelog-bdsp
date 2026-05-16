import { describe, it, expect } from "vitest";
import {
  NATIONAL_DEX,
  SINNOH_DEX_ORDER,
  SPECIES_PICKLIST,
  SPECIES_NAME_TO_ID,
  SPECIES_ID_TO_NAME,
  lookupSpeciesId,
} from "@/lib/pokedex";

describe("NATIONAL_DEX", () => {
  it("has exactly 493 entries", () => {
    expect(NATIONAL_DEX.length).toBe(493);
  });

  it("is ascending with id === index + 1", () => {
    NATIONAL_DEX.forEach((entry, i) => {
      expect(entry.id).toBe(i + 1);
    });
  });

  it("every name is a non-empty, trimmed string", () => {
    for (const entry of NATIONAL_DEX) {
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.name).toBe(entry.name.trim());
    }
  });

  it("all 493 names are unique", () => {
    expect(new Set(NATIONAL_DEX.map((e) => e.name)).size).toBe(493);
  });
});

describe("SINNOH_DEX_ORDER", () => {
  it("has exactly 151 entries", () => {
    expect(SINNOH_DEX_ORDER.length).toBe(151);
  });

  it("every value is an integer in 1..493", () => {
    for (const id of SINNOH_DEX_ORDER) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(493);
    }
  });

  it("all 151 values are unique", () => {
    expect(new Set(SINNOH_DEX_ORDER).size).toBe(151);
  });

  it("every id is present in SPECIES_ID_TO_NAME", () => {
    for (const id of SINNOH_DEX_ORDER) {
      expect(SPECIES_ID_TO_NAME.has(id)).toBe(true);
    }
  });

  it("starts with 387 (ナエトル / Turtwig)", () => {
    expect(SINNOH_DEX_ORDER[0]).toBe(387);
  });
});

describe("SPECIES_PICKLIST", () => {
  it("has exactly 493 entries", () => {
    expect(SPECIES_PICKLIST.length).toBe(493);
  });

  it("first 151 ids equal SINNOH_DEX_ORDER", () => {
    expect(SPECIES_PICKLIST.slice(0, 151).map((e) => e.id)).toEqual([
      ...SINNOH_DEX_ORDER,
    ]);
  });

  it("entries 151+ equal NATIONAL_DEX minus the Sinnoh set", () => {
    const sinnohSet = new Set(SINNOH_DEX_ORDER);
    expect(SPECIES_PICKLIST.slice(151)).toEqual(
      NATIONAL_DEX.filter((e) => !sinnohSet.has(e.id)),
    );
  });

  it("entries 151+ are strictly ascending by id", () => {
    const rest = SPECIES_PICKLIST.slice(151);
    for (let i = 1; i < rest.length; i++) {
      expect(rest[i].id).toBeGreaterThan(rest[i - 1].id);
    }
  });

  it("ids are a permutation of 1..493", () => {
    const ids = SPECIES_PICKLIST.map((e) => e.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 493 }, (_, i) => i + 1));
  });
});

describe("SPECIES name/id maps", () => {
  it("both maps have 493 entries", () => {
    expect(SPECIES_NAME_TO_ID.size).toBe(493);
    expect(SPECIES_ID_TO_NAME.size).toBe(493);
  });

  it("round-trips every NATIONAL_DEX entry", () => {
    for (const { id, name } of NATIONAL_DEX) {
      expect(SPECIES_NAME_TO_ID.get(name)).toBe(id);
      expect(SPECIES_ID_TO_NAME.get(id)).toBe(name);
    }
  });
});

describe("lookupSpeciesId", () => {
  it("resolves a known name", () => {
    expect(lookupSpeciesId("ナエトル")).toBe(387);
  });

  it("trims whitespace before lookup", () => {
    expect(lookupSpeciesId("  ナエトル  ")).toBe(387);
  });

  it("returns undefined for a Gen5 species (absent)", () => {
    expect(lookupSpeciesId("ゾロア")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(lookupSpeciesId("")).toBeUndefined();
  });
});

describe("anchor spot-checks", () => {
  const anchors: ReadonlyArray<readonly [number, string]> = [
    [1, "フシギダネ"],
    [4, "ヒトカゲ"],
    [7, "ゼニガメ"],
    [25, "ピカチュウ"],
    [150, "ミュウツー"],
    [151, "ミュウ"],
    [152, "チコリータ"],
    [252, "キモリ"],
    [386, "デオキシス"],
    [387, "ナエトル"],
    [390, "ヒコザル"],
    [393, "ポッチャマ"],
    [493, "アルセウス"],
  ];

  for (const [id, name] of anchors) {
    it(`id ${id} === ${name}`, () => {
      expect(SPECIES_ID_TO_NAME.get(id)).toBe(name);
      expect(SPECIES_NAME_TO_ID.get(name)).toBe(id);
    });
  }

  it("ゾロア (Gen5) is absent", () => {
    expect(SPECIES_NAME_TO_ID.has("ゾロア")).toBe(false);
  });

  it("コダック is present (id 54)", () => {
    expect(SPECIES_NAME_TO_ID.has("コダック")).toBe(true);
    expect(SPECIES_NAME_TO_ID.get("コダック")).toBe(54);
  });
});
