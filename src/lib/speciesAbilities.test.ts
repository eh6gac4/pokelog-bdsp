import { describe, it, expect } from "vitest";
import { abilitiesForSpecies } from "./speciesAbilities";
import { NATIONAL_DEX } from "./pokedex";

describe("abilitiesForSpecies", () => {
  it("シンオウ御三家の特性を返す", () => {
    expect(abilitiesForSpecies(393)).toEqual(["げきりゅう", "まけんき"]); // ポッチャマ
    expect(abilitiesForSpecies(390)).toEqual(["もうか", "てつのこぶし"]); // ヒコザル
    expect(abilitiesForSpecies(387)).toEqual(["しんりょく", "シェルアーマー"]); // ナエトル
  });

  it("未選択(0)・未知の図鑑番号は空配列", () => {
    expect(abilitiesForSpecies(0)).toEqual([]);
    expect(abilitiesForSpecies(99999)).toEqual([]);
  });

  it("全国図鑑 1..493 すべてに 1 つ以上の特性データがある", () => {
    const missing = NATIONAL_DEX.filter(
      (e) => abilitiesForSpecies(e.id).length === 0,
    ).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("各種族の特性候補に空文字・重複が無い", () => {
    for (const e of NATIONAL_DEX) {
      const abilities = abilitiesForSpecies(e.id);
      expect(abilities.every((a) => a.length > 0)).toBe(true);
      expect(new Set(abilities).size).toBe(abilities.length);
    }
  });
});
