import { renderHook, act, waitFor } from "@testing-library/react";
import { usePokemonLog } from "./usePokemonLog";
import { emptyEvSpread, type PokemonEntry } from "@/types/pokemon";

const STORAGE_KEY = "pokelog-bdsp-v1";
const ISO = "2026-05-15T00:00:00.000Z";

function baseData(): Omit<PokemonEntry, "id" | "createdAt" | "updatedAt"> {
  return {
    speciesId: 1,
    speciesName: "フシギダネ",
    nickname: "だね",
    level: 5,
    evs: emptyEvSpread(),
    nature: "がんばりや",
    caughtAt: "トキワの森",
    notes: "メモ",
  };
}

// Deterministic timestamps without freezing timers: the hook builds its
// createdAt/updatedAt via `new Date().toISOString()`. Spying on toISOString
// keeps `waitFor` working (fake timers would deadlock waitFor's polling).
function mockNowIso(iso: string) {
  return vi
    .spyOn(Date.prototype, "toISOString")
    .mockReturnValue(iso);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePokemonLog", () => {
  it("newEntryDefaults returns expected defaults with a fresh evs spread", () => {
    const { result } = renderHook(() => usePokemonLog());
    const d1 = result.current.newEntryDefaults();
    const d2 = result.current.newEntryDefaults();

    expect(d1).toEqual({
      speciesId: 0,
      speciesName: "",
      nickname: "",
      level: 1,
      evs: emptyEvSpread(),
      nature: "",
      caughtAt: "",
      notes: "",
    });
    expect(d1.evs).toEqual(emptyEvSpread());
    expect(d1.evs).not.toBe(d2.evs);
  });

  it("add() creates an entry with id/createdAt/updatedAt and persists it", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111"
    );

    const { result } = renderHook(() => usePokemonLog());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    mockNowIso(ISO);

    let returned: PokemonEntry;
    act(() => {
      returned = result.current.add(baseData());
    });

    expect(returned!.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(returned!.createdAt).toBe(ISO);
    expect(returned!.updatedAt).toBe(ISO);
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toEqual(returned!);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("add() twice preserves append order", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");

    const { result } = renderHook(() => usePokemonLog());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    mockNowIso(ISO);

    act(() => {
      result.current.add({ ...baseData(), speciesName: "first" });
    });
    act(() => {
      result.current.add({ ...baseData(), speciesName: "second" });
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].speciesName).toBe("first");
    expect(result.current.entries[1].speciesName).toBe("second");
    expect(result.current.entries[0].id).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(result.current.entries[1].id).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
  });

  it("update() bumps updatedAt, keeps createdAt, leaves others untouched", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const { result } = renderHook(() => usePokemonLog());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    const later = "2026-06-01T12:00:00.000Z";
    const isoSpy = vi.spyOn(Date.prototype, "toISOString");
    // Both add() calls use ISO; the later update() uses `later`.
    isoSpy
      .mockReturnValueOnce(ISO)
      .mockReturnValueOnce(ISO)
      .mockReturnValue(later);

    act(() => {
      result.current.add({ ...baseData(), speciesName: "target" });
    });
    act(() => {
      result.current.add({ ...baseData(), speciesName: "other" });
    });

    act(() => {
      result.current.update("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        nickname: "updated",
      });
    });

    const target = result.current.entries.find(
      (e) => e.id === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )!;
    const other = result.current.entries.find(
      (e) => e.id === "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    )!;

    expect(target.nickname).toBe("updated");
    expect(target.createdAt).toBe(ISO);
    expect(target.updatedAt).toBe(later);
    expect(other.nickname).toBe("だね");
    expect(other.updatedAt).toBe(ISO);
  });

  it("update() / remove() with unknown id are no-ops; remove on empty is a no-op", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111"
    );

    const { result } = renderHook(() => usePokemonLog());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    mockNowIso(ISO);

    act(() => {
      result.current.remove("nope");
    });
    expect(result.current.entries).toHaveLength(0);

    act(() => {
      result.current.add(baseData());
    });
    const snapshot = result.current.entries;

    act(() => {
      result.current.update("missing", { nickname: "x" });
    });
    expect(result.current.entries).toEqual(snapshot);

    act(() => {
      result.current.remove("missing");
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it("hydrates from pre-seeded localStorage", async () => {
    const seeded: PokemonEntry[] = [
      {
        ...baseData(),
        id: "seed-1",
        createdAt: ISO,
        updatedAt: ISO,
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));

    const { result } = renderHook(() => usePokemonLog());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.entries).toEqual(seeded);
  });
});
