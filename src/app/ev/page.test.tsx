import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EvLogPage from "./page";
import { PokemonEntry, emptyEvSpread } from "@/types/pokemon";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

const LOG_KEY = "pokelog-bdsp-v1";

function makeEntry(partial: Partial<PokemonEntry> = {}): PokemonEntry {
  return {
    id: "seed-1",
    speciesId: 393,
    speciesName: "ポッチャマ",
    nickname: "ぽち",
    level: 12,
    evs: emptyEvSpread(),
    nature: "ひかえめ",
    caughtAt: "マサゴタウン",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function readLog(): PokemonEntry[] {
  const raw = localStorage.getItem(LOG_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe("EvLogPage (/ev) integration", () => {
  it("shows empty state with 0 count after hydration", async () => {
    render(<EvLogPage />);
    // React 19 + RTL flushes mount effects during render, so hydration
    // completes synchronously; wait for the loading text to be gone.
    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    expect(screen.getByText("まだ登録がありません")).toBeInTheDocument();
    expect(
      screen.getByText("「+ 追加」からポケモンを登録しましょう")
    ).toBeInTheDocument();
    expect(screen.getByText("0 匹登録中")).toBeInTheDocument();
  });

  it("adds a pokemon end-to-end and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<EvLogPage />);

    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-1111-4111-8111-111111111111");
    const isoSpy = vi
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValue("2026-05-15T00:00:00.000Z");

    await user.click(screen.getByRole("button", { name: "+ 追加" }));

    // Modal opens.
    expect(screen.getByText("ポケモンを追加")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("ポッチャマ"), "ヒコザル");
    await user.type(screen.getByPlaceholderText("393"), "390");
    await user.click(screen.getByRole("button", { name: "追加" }));

    // Card appears with the species; count updates.
    await waitFor(() =>
      expect(screen.getByText("1 匹登録中")).toBeInTheDocument()
    );
    expect(screen.getByText("ヒコザル")).toBeInTheDocument();

    const stored = readLog();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      speciesName: "ヒコザル",
      speciesId: 390,
      level: 1,
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    });

    uuidSpy.mockRestore();
    isoSpy.mockRestore();
  });

  it("renders two seeded entries with count 2", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        makeEntry({ id: "a", speciesName: "ナエトル", nickname: "" }),
        makeEntry({ id: "b", speciesName: "ヒコザル", nickname: "" }),
      ])
    );

    render(<EvLogPage />);

    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    expect(screen.getByText("2 匹登録中")).toBeInTheDocument();
    expect(screen.getByText("ナエトル")).toBeInTheDocument();
    expect(screen.getByText("ヒコザル")).toBeInTheDocument();
  });

  it("expands a seeded card, edits a field, persists; deletes a card", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        makeEntry({ id: "a", speciesName: "ナエトル", nickname: "" }),
        makeEntry({ id: "b", speciesName: "ヒコザル", nickname: "" }),
      ])
    );

    render(<EvLogPage />);

    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    // Expand the first card by clicking its header button.
    const header = screen.getByRole("button", { name: /ナエトル/ });
    await user.click(header);

    // Edit the nickname field (currently empty for entry "a").
    const nicknameInput = screen.getByDisplayValue("ナエトル");
    // species input shows ナエトル; find the species input precisely.
    expect(nicknameInput).toBeInTheDocument();
    const speciesInput = screen.getByDisplayValue("ナエトル") as HTMLInputElement;
    await user.clear(speciesInput);
    await user.type(speciesInput, "ナエトルX");

    await waitFor(() => {
      const stored = readLog();
      const a = stored.find((e) => e.id === "a")!;
      expect(a.speciesName).toBe("ナエトルX");
    });

    // Delete the second card.
    const secondHeader = screen.getByRole("button", { name: /ヒコザル/ });
    await user.click(secondHeader);
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    await user.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(screen.getByText("1 匹登録中")).toBeInTheDocument()
    );
    expect(screen.queryByText("ヒコザル")).not.toBeInTheDocument();

    const stored = readLog();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("a");
  });
});
