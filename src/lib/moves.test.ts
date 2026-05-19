import { describe, it, expect } from "vitest";
import {
  MOVES,
  SPECIES_LEARNSET,
  movesForSpecies,
  classifiedMovesForSpecies,
  moveInfo,
} from "./moves";

const CATEGORIES = new Set(["physical", "special", "status"]);

describe("moves data (generated from PokeAPI / BDSP)", () => {
  it("シンオウ御三家が BDSP 学習技（レベルアップ含む）を持つ", () => {
    // ナエトル(387) / ヒコザル(390) / ポッチャマ(393)
    for (const id of [387, 390, 393]) {
      expect(movesForSpecies(id).length).toBeGreaterThan(0);
      expect(SPECIES_LEARNSET[id].levelUp.length).toBeGreaterThan(0);
    }
  });

  it("未選択(0)・未知の図鑑番号は共有の空配列 / classified は null", () => {
    expect(movesForSpecies(0)).toEqual([]);
    expect(movesForSpecies(99999)).toEqual([]);
    // 同一参照（NO_MOVES）を返しメモリを無駄にしない
    expect(movesForSpecies(0)).toBe(movesForSpecies(0));
    expect(classifiedMovesForSpecies(0)).toBeNull();
    expect(classifiedMovesForSpecies(99999)).toBeNull();
  });

  it("生成が破綻していない（十分な数の技と種族をカバー）", () => {
    expect(Object.keys(MOVES).length).toBeGreaterThan(100);
    expect(Object.keys(SPECIES_LEARNSET).length).toBeGreaterThan(100);
  });

  it("MOVES の各エントリが妥当", () => {
    for (const key of Object.keys(MOVES)) {
      const info = MOVES[Number(key)];
      expect(info.name.length).toBeGreaterThan(0);
      expect(CATEGORIES.has(info.category)).toBe(true);
      expect(info.pp).toBeGreaterThan(0);
      expect(info.power === null || info.power >= 0).toBe(true);
      expect(info.type.length).toBeGreaterThan(0);
    }
  });

  it("SPECIES_LEARNSET の id は全て MOVES に存在、バケツ内重複なし", () => {
    for (const key of Object.keys(SPECIES_LEARNSET)) {
      const ls = SPECIES_LEARNSET[Number(key)];

      const lvIds = ls.levelUp.map(([id]) => id);
      expect(new Set(lvIds).size).toBe(lvIds.length);
      for (const [id, level] of ls.levelUp) {
        expect(MOVES[id]).toBeDefined();
        expect(Number.isInteger(level)).toBe(true);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(100);
      }
      // levelUp は (level, id) 昇順
      for (let i = 1; i < ls.levelUp.length; i++) {
        const [pid, pl] = ls.levelUp[i - 1];
        const [cid, cl] = ls.levelUp[i];
        expect(pl < cl || (pl === cl && pid <= cid)).toBe(true);
      }

      for (const bucket of [ls.machine, ls.egg, ls.tutor, ls.other]) {
        expect(new Set(bucket).size).toBe(bucket.length);
        for (const id of bucket) expect(MOVES[id]).toBeDefined();
      }
    }
  });

  it("一定数の種族がレベルアップ技を持つ（新フィールド解析の回帰検出）", () => {
    const withLevelUp = Object.keys(SPECIES_LEARNSET).filter(
      (k) => SPECIES_LEARNSET[Number(k)].levelUp.length > 0,
    );
    expect(withLevelUp.length).toBeGreaterThan(100);
  });

  it("classifiedMovesForSpecies は名前/レベルを解決し movesForSpecies と整合", () => {
    const cls = classifiedMovesForSpecies(393)!;
    expect(cls).not.toBeNull();
    expect(cls.levelUp.length).toBeGreaterThan(0);
    expect(cls.levelUp.every((m) => m.name.length > 0)).toBe(true);
    expect(cls.levelUp.every((m) => Number.isInteger(m.level))).toBe(true);

    const union = new Set([
      ...cls.levelUp.map((m) => m.name),
      ...cls.machine,
      ...cls.egg,
      ...cls.tutor,
      ...cls.other,
    ]);
    // movesForSpecies は全バケツの一意名和集合
    expect(movesForSpecies(393).length).toBe(union.size);
  });

  it("movesForSpecies は技名を返し moveInfo で逆引きできる", () => {
    const names = movesForSpecies(393);
    expect(names.every((n) => n.length > 0)).toBe(true);
    const info = moveInfo(names[0]);
    expect(info).toBeDefined();
    expect(info!.name).toBe(names[0]);
  });
});
