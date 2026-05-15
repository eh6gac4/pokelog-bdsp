import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PartyPage from "./page";
import { Party, PartyMember } from "@/types/party";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

const PARTY_KEY = "pokelog-bdsp-party-v1";

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
    ...partial,
  };
}

function seedParty(party: Partial<Party>) {
  const full: Party = {
    name: "",
    version: "bd",
    members: [],
    ...party,
  };
  localStorage.setItem(PARTY_KEY, JSON.stringify(full));
}

function readParty(): Party {
  const raw = localStorage.getItem(PARTY_KEY);
  return raw ? JSON.parse(raw) : { name: "", version: "bd", members: [] };
}

describe("PartyPage (/) integration", () => {
  it("shows empty party state and 0 / 6 count after hydration", async () => {
    render(<PartyPage />);
    // React 19 + RTL flushes mount effects during render, so hydration
    // completes synchronously; wait for the loading text to be gone.
    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    expect(screen.getByText("メンバー未登録")).toBeInTheDocument();
    expect(screen.getByText("0 / 6 体")).toBeInTheDocument();
  });

  it("persists party name and version changes to localStorage", async () => {
    const user = userEvent.setup();
    const { container } = render(<PartyPage />);

    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    const nameInput = screen.getByPlaceholderText("旅パ名");
    await user.type(nameInput, "ぼうけん");

    await waitFor(() => expect(readParty().name).toBe("ぼうけん"));

    const select = container.querySelector("select") as HTMLSelectElement;
    await user.selectOptions(select, "sp");

    await waitFor(() => expect(readParty().version).toBe("sp"));
  });

  it("adds a member via the 新規入力 tab and persists, count -> 1 / 6 体", async () => {
    const user = userEvent.setup();
    render(<PartyPage />);

    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("22222222-2222-4222-8222-222222222222");

    await user.click(screen.getByRole("button", { name: "+ メンバー追加" }));
    expect(screen.getByText("メンバーを追加")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("ポッチャマ"), "ナエトル");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() =>
      expect(screen.getByText("1 / 6 体")).toBeInTheDocument()
    );
    expect(screen.getByText("ナエトル")).toBeInTheDocument();

    const stored = readParty();
    expect(stored.members).toHaveLength(1);
    expect(stored.members[0]).toMatchObject({
      id: "22222222-2222-4222-8222-222222222222",
      speciesName: "ナエトル",
      level: 1,
    });

    uuidSpy.mockRestore();
  });

  it("hides + メンバー追加 at 6 members, shows it at 5", async () => {
    seedParty({
      members: Array.from({ length: 6 }, (_, i) =>
        makeMember({ id: `s${i}`, speciesName: `ポケ${i}` })
      ),
    });

    const { unmount } = render(<PartyPage />);
    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );
    expect(screen.getByText("6 / 6 体")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ メンバー追加" })
    ).not.toBeInTheDocument();
    unmount();

    seedParty({
      members: Array.from({ length: 5 }, (_, i) =>
        makeMember({ id: `t${i}`, speciesName: `ポケ${i}` })
      ),
    });
    render(<PartyPage />);
    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );
    expect(screen.getByText("5 / 6 体")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ メンバー追加" })
    ).toBeInTheDocument();
  });

  it("reset on empty party does NOT call window.confirm", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true);

    render(<PartyPage />);
    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "リセット" }));
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("reset on non-empty party: confirm=false keeps party, confirm=true clears it", async () => {
    const user = userEvent.setup();

    seedParty({
      name: "たび",
      members: [makeMember({ id: "x1", speciesName: "ポッチャマ" })],
    });

    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false);

    render(<PartyPage />);
    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "リセット" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // unchanged
    expect(screen.getByText("ポッチャマ")).toBeInTheDocument();
    expect(readParty().members).toHaveLength(1);
    expect(readParty().name).toBe("たび");

    // Now allow the reset.
    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "リセット" }));

    await waitFor(() =>
      expect(screen.getByText("メンバー未登録")).toBeInTheDocument()
    );
    expect(screen.getByText("0 / 6 体")).toBeInTheDocument();
    const stored = readParty();
    expect(stored.members).toHaveLength(0);
    expect(stored.name).toBe("");

    confirmSpy.mockRestore();
  });

  it("modal ability/heldItem datalists dedupe non-empty suggestions", async () => {
    const user = userEvent.setup();

    seedParty({
      members: [
        makeMember({ id: "a", ability: "げきりゅう", heldItem: "たべのこし" }),
        makeMember({ id: "b", ability: "げきりゅう", heldItem: "" }),
        makeMember({ id: "c", ability: "", heldItem: "きあいのタスキ" }),
        makeMember({ id: "d", ability: "もうか", heldItem: "たべのこし" }),
        makeMember({ id: "e", ability: "", heldItem: "" }),
      ],
    });

    render(<PartyPage />);
    await waitFor(() =>
      expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "+ メンバー追加" }));
    expect(screen.getByText("メンバーを追加")).toBeInTheDocument();

    const abilityList = document.getElementById(
      "modal-ability-list"
    ) as HTMLDataListElement;
    const abilityValues = Array.from(abilityList.querySelectorAll("option")).map(
      (o) => o.value
    );
    expect(abilityValues).toEqual(["げきりゅう", "もうか"]);

    const heldList = document.getElementById(
      "modal-held-item-list"
    ) as HTMLDataListElement;
    const heldValues = Array.from(heldList.querySelectorAll("option")).map(
      (o) => o.value
    );
    expect(heldValues).toEqual(["たべのこし", "きあいのタスキ"]);
  });
});
