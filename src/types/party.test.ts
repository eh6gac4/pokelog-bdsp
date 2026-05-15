import {
  GAME_VERSIONS,
  GAME_VERSION_LABELS,
  NATURES,
  PARTY_MAX_MEMBERS,
  emptyParty,
} from "./party";

describe("emptyParty", () => {
  it("returns the expected empty shape", () => {
    expect(emptyParty()).toEqual({ name: "", version: "bd", members: [] });
  });

  it("returns a fresh members array each call", () => {
    const a = emptyParty();
    const b = emptyParty();
    expect(a.members).not.toBe(b.members);
  });
});

describe("NATURES", () => {
  it("has exactly 25 entries", () => {
    expect(NATURES).toHaveLength(25);
  });

  it("are all unique", () => {
    expect(new Set(NATURES).size).toBe(NATURES.length);
  });

  it("includes the boundary natures", () => {
    expect(NATURES).toContain("がんばりや");
    expect(NATURES).toContain("きまぐれ");
  });
});

describe("GAME_VERSIONS / GAME_VERSION_LABELS", () => {
  it("is exactly [bd, sp]", () => {
    expect([...GAME_VERSIONS]).toEqual(["bd", "sp"]);
  });

  it("has a non-empty label for every version", () => {
    for (const v of GAME_VERSIONS) {
      const label = GAME_VERSION_LABELS[v];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("PARTY_MAX_MEMBERS", () => {
  it("is 6", () => {
    expect(PARTY_MAX_MEMBERS).toBe(6);
  });
});
