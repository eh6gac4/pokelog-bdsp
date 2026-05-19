import { renderHook, act, waitFor } from "@testing-library/react";
import { useParty } from "./useParty";
import { emptyMoves, emptyParty, type PartyMember } from "@/types/party";

// updateMember の種族変更時フィルタを生成データに依存させない。
vi.mock("@/lib/moves", () => ({
  movesForSpecies: (id: number) =>
    id === 393
      ? ["はたく", "なきごえ", "あわ", "つつく"]
      : id === 1
        ? ["たいあたり", "なきごえ", "つるのムチ"]
        : [],
}));

const STORAGE_KEY = "pokelog-bdsp-party-v1";

function memberData(
  overrides: Partial<Omit<PartyMember, "id">> = {}
): Omit<PartyMember, "id"> {
  return {
    speciesId: 1,
    speciesName: "フシギダネ",
    nickname: "だね",
    level: 5,
    nature: "がんばりや",
    ability: "しんりょく",
    heldItem: "",
    moves: emptyMoves(),
    notes: "",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useParty", () => {
  it("starts as an empty party", async () => {
    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.party).toEqual(emptyParty());
  });

  it("updateParty merges name/version without touching members", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111"
    );
    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.addMember(memberData());
    });
    act(() => {
      result.current.updateParty({ name: "MyTeam" });
    });
    act(() => {
      result.current.updateParty({ version: "sp" });
    });

    expect(result.current.party.name).toBe("MyTeam");
    expect(result.current.party.version).toBe("sp");
    expect(result.current.party.members).toHaveLength(1);
  });

  it("addMember appends with a generated id and persists", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "abcdef00-0000-4000-8000-000000000000"
    );
    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.addMember(memberData({ nickname: "one" }));
    });

    expect(result.current.party.members).toHaveLength(1);
    expect(result.current.party.members[0].id).toBe(
      "abcdef00-0000-4000-8000-000000000000"
    );
    expect(result.current.party.members[0].nickname).toBe("one");

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.members).toHaveLength(1);
    expect(persisted.members[0].id).toBe(
      "abcdef00-0000-4000-8000-000000000000"
    );
  });

  it("caps the party at 6 members", async () => {
    const spy = vi.spyOn(crypto, "randomUUID");
    for (let i = 1; i <= 6; i++) {
      spy.mockReturnValueOnce(
        `0000000${i}-0000-4000-8000-00000000000${i}` as `${string}-${string}-${string}-${string}-${string}`
      );
    }
    spy.mockReturnValue(
      "99999999-9999-4999-8999-999999999999"
    );

    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    for (let i = 1; i <= 6; i++) {
      act(() => {
        result.current.addMember(memberData({ nickname: `m${i}` }));
      });
      expect(result.current.party.members).toHaveLength(i);
    }

    act(() => {
      result.current.addMember(memberData({ nickname: "SEVENTH" }));
    });

    expect(result.current.party.members).toHaveLength(6);
    expect(
      result.current.party.members.some((m) => m.nickname === "SEVENTH")
    ).toBe(false);
  });

  it("updateMember updates only the matching member; unknown id is a no-op", async () => {
    const spy = vi.spyOn(crypto, "randomUUID");
    spy.mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    spy.mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.addMember(memberData({ nickname: "a" }));
    });
    act(() => {
      result.current.addMember(memberData({ nickname: "b" }));
    });

    act(() => {
      result.current.updateMember("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        level: 99,
      });
    });

    const a = result.current.party.members.find(
      (m) => m.id === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )!;
    const b = result.current.party.members.find(
      (m) => m.id === "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    )!;
    expect(a.level).toBe(99);
    expect(b.level).toBe(5);

    const before = result.current.party.members;
    act(() => {
      result.current.updateMember("unknown", { level: 1 });
    });
    expect(result.current.party.members).toEqual(before);
  });

  it("removeMember removes the matching member; unknown id is a no-op", async () => {
    const spy = vi.spyOn(crypto, "randomUUID");
    spy.mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    spy.mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.addMember(memberData({ nickname: "a" }));
    });
    act(() => {
      result.current.addMember(memberData({ nickname: "b" }));
    });

    act(() => {
      result.current.removeMember("unknown");
    });
    expect(result.current.party.members).toHaveLength(2);

    act(() => {
      result.current.removeMember("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    });
    expect(result.current.party.members).toHaveLength(1);
    expect(result.current.party.members[0].id).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );
  });

  it("旧データ(moves 無し)を読むと長さ4の空配列に正規化される", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: "old",
        version: "bd",
        members: [
          {
            id: "legacy",
            speciesId: 1,
            speciesName: "フシギダネ",
            nickname: "",
            level: 5,
            nature: "",
            ability: "",
            heldItem: "",
            notes: "",
            // moves フィールドが存在しない（旧スキーマ）
          },
        ],
      })
    );

    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.party.members[0].moves).toEqual(["", "", "", ""]);
  });

  it("addMember は moves を長さ4に正規化して永続する", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111"
    );
    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.addMember(
        memberData({ moves: ["はたく"] as unknown as string[] })
      );
    });

    expect(result.current.party.members[0].moves).toEqual([
      "はたく",
      "",
      "",
      "",
    ]);
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.members[0].moves).toEqual(["はたく", "", "", ""]);
  });

  it("updateMember で種族が変わると新種族で覚えない技を落とす", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    );
    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.addMember(
        memberData({ speciesId: 393, moves: ["はたく", "あわ", "", ""] })
      );
    });
    act(() => {
      // 1 番(フシギダネ)は「はたく」「あわ」を覚えない → "" にクリア
      result.current.updateMember("cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
        speciesId: 1,
      });
    });

    expect(result.current.party.members[0].moves).toEqual(["", "", "", ""]);
  });

  it("resetParty restores the empty party", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111"
    );
    const { result } = renderHook(() => useParty());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.updateParty({ name: "ToReset", version: "sp" });
    });
    act(() => {
      result.current.addMember(memberData());
    });
    expect(result.current.party.members).toHaveLength(1);

    act(() => {
      result.current.resetParty();
    });

    expect(result.current.party).toEqual(emptyParty());
    expect(result.current.party.name).toBe("");
    expect(result.current.party.members).toEqual([]);
    expect(result.current.party.version).toBe("bd");
  });
});
