import {
  EV_STATS,
  EV_STAT_LABELS,
  emptyEvSpread,
  totalEvs,
} from "./pokemon";

describe("emptyEvSpread", () => {
  it("returns exactly a zeroed spread", () => {
    expect(emptyEvSpread()).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    });
  });

  it("returns a fresh object each call (no shared reference)", () => {
    const a = emptyEvSpread();
    const b = emptyEvSpread();
    expect(a).not.toBe(b);
    a.hp = 252;
    expect(b.hp).toBe(0);
  });
});

describe("totalEvs", () => {
  it("is 0 for an empty spread", () => {
    expect(totalEvs(emptyEvSpread())).toBe(0);
  });

  it("sums to 510 at the legal-max boundary", () => {
    expect(
      totalEvs({ hp: 252, atk: 252, def: 6, spa: 0, spd: 0, spe: 0 })
    ).toBe(510);
  });

  it("does not clamp — returns the raw sum", () => {
    expect(
      totalEvs({ hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 })
    ).toBe(1512);
  });
});

describe("EV_STATS / EV_STAT_LABELS", () => {
  it("has length 6 in exact order", () => {
    expect(EV_STATS).toHaveLength(6);
    expect([...EV_STATS]).toEqual(["hp", "atk", "def", "spa", "spd", "spe"]);
  });

  it("has a non-empty label for every stat", () => {
    for (const stat of EV_STATS) {
      const label = EV_STAT_LABELS[stat];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
