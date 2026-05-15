import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPokemonModal } from "./AddPokemonModal";
import { emptyEvSpread } from "@/types/pokemon";

describe("AddPokemonModal", () => {
  it("renders species name input and 追加 / キャンセル buttons", () => {
    render(<AddPokemonModal onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByPlaceholderText("ポッチャマ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "追加" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });

  it("trim guard: whitespace-only species name does not call onAdd/onClose", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<AddPokemonModal onAdd={onAdd} onClose={onClose} />);
    const species = screen.getByPlaceholderText("ポッチャマ");
    await user.type(species, "   ");
    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("happy path: submit calls onAdd with FormData shape then onClose", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<AddPokemonModal onAdd={onAdd} onClose={onClose} />);
    await user.type(screen.getByPlaceholderText("ポッチャマ"), "ポッチャマ");
    await user.type(screen.getByPlaceholderText("393"), "393");
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const data = onAdd.mock.calls[0][0];
    expect(data.speciesName).toBe("ポッチャマ");
    expect(data.speciesId).toBe(393);
    expect(typeof data.speciesId).toBe("number");
    expect(data.level).toBe(1);
    expect(data.evs).toEqual(emptyEvSpread());
    expect(data.nickname).toBe("");
    expect(data.nature).toBe("");
    expect(data.caughtAt).toBe("");
    expect(data.notes).toBe("");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("speciesId field is empty when 0 and sends a number when typed", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddPokemonModal onAdd={onAdd} onClose={() => {}} />);
    const idInput = screen.getByPlaceholderText("393") as HTMLInputElement;
    expect(idInput.value).toBe("");
    await user.type(idInput, "12");
    expect(idInput.value).toBe("12");
    await user.type(screen.getByPlaceholderText("ポッチャマ"), "テスト");
    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(onAdd.mock.calls[0][0].speciesId).toBe(12);
  });

  it("キャンセル calls onClose only, never onAdd", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<AddPokemonModal onAdd={onAdd} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
