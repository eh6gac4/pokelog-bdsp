import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPartyMemberModal } from "./AddPartyMemberModal";
import { PokemonEntry, emptyEvSpread } from "@/types/pokemon";

function makeEntry(partial: Partial<PokemonEntry> = {}): PokemonEntry {
  return {
    id: "e1",
    speciesId: 393,
    speciesName: "ポッチャマ",
    nickname: "ぽち",
    level: 12,
    evs: emptyEvSpread(),
    nature: "ひかえめ",
    caughtAt: "",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function renderModal(props: Partial<{
  logEntries: PokemonEntry[];
  abilitySuggestions: string[];
  heldItemSuggestions: string[];
}> = {}) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(
    <AddPartyMemberModal
      logEntries={props.logEntries ?? []}
      abilitySuggestions={props.abilitySuggestions ?? []}
      heldItemSuggestions={props.heldItemSuggestions ?? []}
      onAdd={onAdd}
      onClose={onClose}
    />,
  );
  return { onAdd, onClose };
}

describe("AddPartyMemberModal", () => {
  it("default tab is 新規入力 with form visible", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "新規入力" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "努力値ログから" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ポッチャマ")).toBeInTheDocument();
  });

  it("log tab with empty entries shows empty message, no form", async () => {
    const user = userEvent.setup();
    renderModal({ logEntries: [] });
    await user.click(screen.getByRole("button", { name: "努力値ログから" }));
    expect(
      screen.getByText("努力値ログにポケモンがいません"),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("ポッチャマ")).not.toBeInTheDocument();
  });

  it("log tab with entries: button per entry; picking reveals prefilled form + hint", async () => {
    const user = userEvent.setup();
    const entry = makeEntry();
    renderModal({ logEntries: [entry] });
    await user.click(screen.getByRole("button", { name: "努力値ログから" }));

    const entryBtn = screen.getByRole("button", { name: /ぽち（ポッチャマ）.*Lv\.12/ });
    expect(entryBtn).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("ポッチャマ")).not.toBeInTheDocument();

    await user.click(entryBtn);
    expect(
      screen.getByText("とくせい・もちものを入力して「追加」を押してください"),
    ).toBeInTheDocument();

    const species = screen.getByPlaceholderText("ポッチャマ") as HTMLInputElement;
    expect(species.value).toBe("ポッチャマ");
    expect((screen.getByPlaceholderText("393") as HTMLInputElement).value).toBe("393");
    expect(screen.getByDisplayValue("ぽち")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
    // inputs with `list` also expose role combobox; target the <select>
    const select = document.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("ひかえめ");
  });

  it("switchTab resets form and selection", async () => {
    const user = userEvent.setup();
    const entry = makeEntry();
    renderModal({ logEntries: [entry] });
    await user.click(screen.getByRole("button", { name: "努力値ログから" }));
    await user.click(screen.getByRole("button", { name: /ぽち（ポッチャマ）/ }));
    expect(screen.getByPlaceholderText("ポッチャマ")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "新規入力" }));
    expect(
      (screen.getByPlaceholderText("ポッチャマ") as HTMLInputElement).value,
    ).toBe("");

    await user.click(screen.getByRole("button", { name: "努力値ログから" }));
    // selection cleared -> no picked form, no hint
    expect(
      screen.queryByText("とくせい・もちものを入力して「追加」を押してください"),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("ポッチャマ")).not.toBeInTheDocument();
  });

  it("new tab whitespace-only species name does not call onAdd/onClose", async () => {
    const user = userEvent.setup();
    const { onAdd, onClose } = renderModal();
    await user.type(screen.getByPlaceholderText("ポッチャマ"), "   ");
    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("happy path new: submit calls onAdd(FormData) then onClose", async () => {
    const user = userEvent.setup();
    const { onAdd, onClose } = renderModal();
    await user.type(screen.getByPlaceholderText("ポッチャマ"), "ヒコザル");
    await user.type(screen.getByPlaceholderText("393"), "390");
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const data = onAdd.mock.calls[0][0];
    expect(data.speciesName).toBe("ヒコザル");
    expect(data.speciesId).toBe(390);
    expect(data.level).toBe(1);
    expect(data.nature).toBe("");
    expect(data.ability).toBe("");
    expect(data.heldItem).toBe("");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("happy path from log: merges copied fields with entered ability/heldItem", async () => {
    const user = userEvent.setup();
    const entry = makeEntry();
    const { onAdd, onClose } = renderModal({
      logEntries: [entry],
      abilitySuggestions: ["げきりゅう"],
      heldItemSuggestions: ["たべのこし"],
    });
    await user.click(screen.getByRole("button", { name: "努力値ログから" }));
    await user.click(screen.getByRole("button", { name: /ぽち（ポッチャマ）/ }));

    const abilityEl = document.querySelector(
      "input[list='modal-ability-list']",
    ) as HTMLInputElement;
    const heldEl = document.querySelector(
      "input[list='modal-held-item-list']",
    ) as HTMLInputElement;
    await user.type(abilityEl, "げきりゅう");
    await user.type(heldEl, "たべのこし");
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const data = onAdd.mock.calls[0][0];
    expect(data.speciesId).toBe(393);
    expect(data.speciesName).toBe("ポッチャマ");
    expect(data.nickname).toBe("ぽち");
    expect(data.level).toBe(12);
    expect(data.nature).toBe("ひかえめ");
    expect(data.ability).toBe("げきりゅう");
    expect(data.heldItem).toBe("たべのこし");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("キャンセル calls onClose in form state", async () => {
    const user = userEvent.setup();
    const { onAdd, onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("キャンセル calls onClose in empty-log state", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ logEntries: [] });
    await user.click(screen.getByRole("button", { name: "努力値ログから" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
