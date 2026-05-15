import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PokemonCard } from "./PokemonCard";
import { PokemonEntry, emptyEvSpread } from "@/types/pokemon";

function makeEntry(partial: Partial<PokemonEntry> = {}): PokemonEntry {
  return {
    id: "e1",
    speciesId: 393,
    speciesName: "ポッチャマ",
    nickname: "",
    level: 5,
    evs: emptyEvSpread(),
    nature: "",
    caughtAt: "",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("PokemonCard", () => {
  it("collapsed by default, toggles expand then collapse", async () => {
    const user = userEvent.setup();
    render(
      <PokemonCard entry={makeEntry()} onUpdate={() => {}} onRemove={() => {}} />,
    );
    expect(screen.queryByText("努力値 (EV)")).not.toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();

    const header = screen.getByRole("button");
    await user.click(header);
    expect(screen.getByText("努力値 (EV)")).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ポッチャマ/ }));
    expect(screen.queryByText("努力値 (EV)")).not.toBeInTheDocument();
  });

  it("display name: nickname（speciesName）", () => {
    render(
      <PokemonCard
        entry={makeEntry({ nickname: "ぽっちゃん", speciesName: "ポッチャマ" })}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("ぽっちゃん（ポッチャマ）")).toBeInTheDocument();
  });

  it("display name: speciesName only", () => {
    render(
      <PokemonCard
        entry={makeEntry({ nickname: "", speciesName: "ヒコザル" })}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("ヒコザル")).toBeInTheDocument();
  });

  it("display name: 不明 when no nickname and no species", () => {
    render(
      <PokemonCard
        entry={makeEntry({ nickname: "", speciesName: "" })}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("不明")).toBeInTheDocument();
  });

  it("header id formatting and level", () => {
    const { rerender } = render(
      <PokemonCard
        entry={makeEntry({ speciesId: 393, level: 5 })}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("#393")).toBeInTheDocument();
    expect(screen.getByText("Lv.5")).toBeInTheDocument();

    // String(0 || "?").padStart(3,"0") => "00?"
    rerender(
      <PokemonCard
        entry={makeEntry({ speciesId: 0 })}
        onUpdate={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("#00?")).toBeInTheDocument();
  });

  it("expanded edits fire onUpdate with field:value", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <PokemonCard
        entry={makeEntry()}
        onUpdate={onUpdate}
        onRemove={() => {}}
      />,
    );
    await user.click(screen.getByRole("button"));

    const speciesInput = screen.getByDisplayValue("ポッチャマ");
    await user.type(speciesInput, "X");
    expect(onUpdate).toHaveBeenLastCalledWith("e1", { speciesName: "ポッチャマX" });

    // level input is the only number input with value 5 (entry.level).
    // Parent never re-renders with new props, so use fireEvent.change to
    // deterministically set the final value -> one onChange.
    const levelInput = screen.getByDisplayValue("5");
    fireEvent.change(levelInput, { target: { value: "9" } });
    expect(onUpdate).toHaveBeenLastCalledWith("e1", { level: 9 });
    expect(typeof onUpdate.mock.calls.at(-1)![1].level).toBe("number");
  });

  it("EvBar wiring merges evs", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const entry = makeEntry({ evs: { hp: 4, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    render(
      <PokemonCard entry={entry} onUpdate={onUpdate} onRemove={() => {}} />,
    );
    await user.click(screen.getByRole("button"));

    // hp EV input is the only input showing "4".
    const hpInput = screen.getByDisplayValue("4");
    fireEvent.change(hpInput, { target: { value: "6" } });
    expect(onUpdate).toHaveBeenLastCalledWith("e1", {
      evs: { hp: 6, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
  });

  it("delete button calls onRemove(entry.id)", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <PokemonCard
        entry={makeEntry()}
        onUpdate={() => {}}
        onRemove={onRemove}
      />,
    );
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(onRemove).toHaveBeenCalledWith("e1");
  });
});
