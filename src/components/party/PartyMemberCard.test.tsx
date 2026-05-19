import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartyMemberCard } from "./PartyMemberCard";
import { NATURES, PartyMember, emptyMoves } from "@/types/party";

function makeMember(partial: Partial<PartyMember> = {}): PartyMember {
  return {
    id: "m1",
    speciesId: 393,
    speciesName: "ポッチャマ",
    nickname: "",
    level: 5,
    nature: "",
    ability: "",
    heldItem: "",
    moves: emptyMoves(),
    notes: "",
    ...partial,
  };
}

describe("PartyMemberCard", () => {
  it("expand/collapse toggle", async () => {
    const user = userEvent.setup();
    render(
      <PartyMemberCard
        member={makeMember()}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("▼")).toBeInTheDocument();
    expect(screen.queryByText("種族名")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("種族名")).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ポッチャマ/ }));
    expect(screen.queryByText("種族名")).not.toBeInTheDocument();
  });

  it("display name logic", () => {
    const { rerender } = render(
      <PartyMemberCard
        member={makeMember({ nickname: "ぽち", speciesName: "ポッチャマ" })}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("ぽち（ポッチャマ）")).toBeInTheDocument();

    rerender(
      <PartyMemberCard
        member={makeMember({ nickname: "", speciesName: "ヒコザル" })}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("ヒコザル")).toBeInTheDocument();

    rerender(
      <PartyMemberCard
        member={makeMember({ nickname: "", speciesName: "" })}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("不明")).toBeInTheDocument();
  });

  it("nature select has 26 options (未設定 + 25 NATURES) and fires onUpdate", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const { container } = render(
      <PartyMemberCard
        member={makeMember()}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={onUpdate}
        onRemove={() => {}}
      />,
    );
    await user.click(within(container).getByRole("button"));
    // inputs with `list` also expose role combobox, so target the <select>
    const select = container.querySelector("select") as HTMLSelectElement;
    const options = within(select).getAllByRole("option");
    expect(options).toHaveLength(NATURES.length + 1);
    expect(options).toHaveLength(26);
    expect(options[0]).toHaveTextContent("未設定");
    expect(options[0]).toHaveValue("");

    await user.selectOptions(select, NATURES[0]);
    expect(onUpdate).toHaveBeenLastCalledWith("m1", { nature: NATURES[0] });
  });

  it("ability is a species-matched select; heldItem keeps per-member datalist", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PartyMemberCard
        member={makeMember()} // ポッチャマ(393)
        abilitySuggestions={["げきりゅう", "するどいめ"]}
        heldItemSuggestions={["きあいのタスキ", "たべのこし"]}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    await user.click(screen.getByRole("button"));

    // とくせいは種族(393=ポッチャマ)に合わせた <select>。
    // select は [せいかく, とくせい] の順。
    const selects = container.querySelectorAll("select");
    const abilitySelect = selects[1] as HTMLSelectElement;
    const opts = Array.from(abilitySelect.options).map((o) => o.value);
    expect(opts).toEqual(["", "げきりゅう", "まけんき"]);
    // 種族データがあるので fallback datalist は描画されない。
    expect(container.querySelector("#ability-list-m1")).toBeNull();

    // もちものは従来どおり datalist 付き input。
    const heldList = container.querySelector("#held-item-list-m1");
    expect(heldList).not.toBeNull();
    expect(heldList!.querySelectorAll("option")).toHaveLength(2);
    const heldInput = container.querySelector(
      "input[list='held-item-list-m1']",
    );
    expect(heldInput).not.toBeNull();
  });

  it("editing fields fires onUpdate with Number coercion for speciesId/level", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <PartyMemberCard
        member={makeMember()}
        abilitySuggestions={["げきりゅう"]}
        heldItemSuggestions={["たべのこし"]}
        onUpdate={onUpdate}
        onRemove={() => {}}
      />,
    );
    await user.click(screen.getByRole("button"));

    await user.type(screen.getByDisplayValue("ポッチャマ"), "X");
    expect(onUpdate).toHaveBeenLastCalledWith("m1", { speciesName: "ポッチャマX" });

    // speciesId input value is "" (393? no, 393 -> "393"). Use placeholder-free
    // approach: speciesId shows "393", level shows "5".
    // Parent never re-renders with new props; use fireEvent.change for a
    // deterministic single onChange with the final value.
    const idInput = screen.getByDisplayValue("393");
    fireEvent.change(idInput, { target: { value: "25" } });
    expect(onUpdate).toHaveBeenLastCalledWith("m1", { speciesId: 25 });
    expect(typeof onUpdate.mock.calls.at(-1)![1].speciesId).toBe("number");

    const levelInput = screen.getByDisplayValue("5");
    fireEvent.change(levelInput, { target: { value: "8" } });
    expect(onUpdate).toHaveBeenLastCalledWith("m1", { level: 8 });
    expect(typeof onUpdate.mock.calls.at(-1)![1].level).toBe("number");

    // ability は種族(393=ポッチャマ)に合わせた <select>。
    // select は [せいかく, とくせい] の順。
    const abilitySelect = document.querySelectorAll(
      "select",
    )[1] as HTMLSelectElement;
    await user.selectOptions(abilitySelect, "げきりゅう");
    expect(onUpdate).toHaveBeenLastCalledWith("m1", { ability: "げきりゅう" });

    const heldEl = document.querySelector(
      "input[list='held-item-list-m1']",
    ) as HTMLInputElement;
    await user.type(heldEl, "た");
    expect(onUpdate).toHaveBeenLastCalledWith("m1", { heldItem: "た" });
  });

  it("メモ textarea を編集すると onUpdate({ notes }) が呼ばれる", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <PartyMemberCard
        member={makeMember({ notes: "" })}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={onUpdate}
        onRemove={() => {}}
      />,
    );
    await user.click(screen.getByRole("button"));
    const memo = screen.getByText("メモ").parentElement!.querySelector(
      "textarea",
    ) as HTMLTextAreaElement;
    await user.type(memo, "メ");
    expect(onUpdate).toHaveBeenLastCalledWith("m1", { notes: "メ" });
  });

  it("notes 欠落の旧データでも textarea は空文字で制御される", async () => {
    const legacy = makeMember();
    // localStorage の旧データ相当（notes フィールドなし）を再現
    delete (legacy as Partial<PartyMember>).notes;
    const { container } = render(
      <PartyMemberCard
        member={legacy}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button"));
    const memo = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(memo.value).toBe("");
  });

  it("delete calls onRemove(id)", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <PartyMemberCard
        member={makeMember()}
        abilitySuggestions={[]}
        heldItemSuggestions={[]}
        onUpdate={() => {}}
        onRemove={onRemove}
      />,
    );
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(onRemove).toHaveBeenCalledWith("m1");
  });
});
