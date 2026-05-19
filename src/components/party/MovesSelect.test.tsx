import { render, screen, fireEvent } from "@testing-library/react";
import { MovesSelect } from "./MovesSelect";

// 生成データに依存しないよう @/lib/moves をモック。
// 393 は学習技あり（学習方法分類つき）、それ以外（0 含む）は null＝自由入力。
// 「はたく」はレベルアップ・わざマシン両方に出す（重複表示の仕様確認用）。
vi.mock("@/lib/moves", () => ({
  classifiedMovesForSpecies: (id: number) =>
    id === 393
      ? {
          levelUp: [
            { name: "はたく", level: 1 },
            { name: "なきごえ", level: 5 },
            { name: "つばさでうつ", level: 0 },
          ],
          machine: ["はたく", "なみのり", "あなをほる"],
          egg: ["れんぞくぎり"],
          tutor: ["ふきとばし"],
          other: [],
        }
      : null,
  // 互換のため残す（このコンポーネントは未使用）。
  movesForSpecies: () => [],
}));

function slot(i: number): HTMLSelectElement {
  return screen.getByLabelText(`わざ${i}`) as HTMLSelectElement;
}
const optgroupLabels = (s: HTMLSelectElement) =>
  Array.from(s.querySelectorAll("optgroup")).map((g) => g.label);

describe("MovesSelect", () => {
  it("学習技がある種族では 4 つの select と学習方法 optgroup を出す", () => {
    render(
      <MovesSelect
        speciesId={393}
        value={["", "", "", ""]}
        onChange={() => {}}
        fallbackListId="t"
        fallbackSuggestions={[]}
      />
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(4);
    expect(screen.getAllByRole("option", { name: "未設定" })).toHaveLength(4);

    const labels = optgroupLabels(slot(1));
    expect(labels).toEqual(["レベルアップ", "わざマシン", "タマゴ", "教え技"]);
    // other が空なので「その他」は出さない
    expect(labels).not.toContain("その他");
  });

  it("レベルアップ option に習得 Lv を表示（Lv.0 は Lv.—）", () => {
    render(
      <MovesSelect
        speciesId={393}
        value={["", "", "", ""]}
        onChange={() => {}}
        fallbackListId="t"
        fallbackSuggestions={[]}
      />
    );
    const texts = Array.from(slot(1).options).map((o) => o.textContent);
    expect(texts).toContain("Lv.5 なきごえ");
    expect(texts).toContain("Lv.1 はたく");
    expect(texts).toContain("Lv.— つばさでうつ");
  });

  it("選択すると技名（ラベルでなく）で長さ4の配列を onChange する", () => {
    const onChange = vi.fn();
    render(
      <MovesSelect
        speciesId={393}
        value={["", "", "", ""]}
        onChange={onChange}
        fallbackListId="t"
        fallbackSuggestions={[]}
      />
    );
    fireEvent.change(slot(1), { target: { value: "なみのり" } });
    expect(onChange).toHaveBeenCalledWith(["なみのり", "", "", ""]);
  });

  it("複数方法で覚える技は各 optgroup に重複表示", () => {
    render(
      <MovesSelect
        speciesId={393}
        value={["", "", "", ""]}
        onChange={() => {}}
        fallbackListId="t"
        fallbackSuggestions={[]}
      />
    );
    const hatakuCount = Array.from(slot(1).options).filter(
      (o) => o.value === "はたく"
    ).length;
    expect(hatakuCount).toBe(2); // レベルアップ + わざマシン
  });

  it("他スロットで選択済みの技は全グループから除外（重複防止）", () => {
    render(
      <MovesSelect
        speciesId={393}
        value={["はたく", "", "", ""]}
        onChange={() => {}}
        fallbackListId="t"
        fallbackSuggestions={[]}
      />
    );
    const slot2Values = Array.from(slot(2).options).map((o) => o.value);
    expect(slot2Values).not.toContain("はたく"); // どの optgroup にも出ない
    // 自スロット わざ1 の現値は残る
    expect(Array.from(slot(1).options).map((o) => o.value)).toContain("はたく");
  });

  it("候補に無い現値は失わず先頭に残す", () => {
    render(
      <MovesSelect
        speciesId={393}
        value={["ハイドロカノン", "", "", ""]}
        onChange={() => {}}
        fallbackListId="t"
        fallbackSuggestions={[]}
      />
    );
    const s1 = slot(1);
    expect(s1.value).toBe("ハイドロカノン");
    expect(Array.from(s1.options).map((o) => o.value)).toContain(
      "ハイドロカノン"
    );
  });

  it("学習技が無い種族では datalist 付き自由入力 4 つにフォールバック", () => {
    render(
      <MovesSelect
        speciesId={0}
        value={["", "", "", ""]}
        onChange={() => {}}
        fallbackListId="fb"
        fallbackSuggestions={["でんこうせっか"]}
      />
    );
    const slots = [1, 2, 3, 4].map((i) => screen.getByLabelText(`わざ${i}`));
    slots.forEach((el, i) => {
      expect(el.tagName).toBe("INPUT");
      expect(el).toHaveAttribute("list", `fb-${i}`);
    });
  });
});
