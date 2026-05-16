import { renderHook, act, waitFor } from "@testing-library/react";
import { useLocalStorage } from "./useLocalStorage";
import { CHANGE_EVENT, DIRTY_KEY } from "@/lib/sync";

describe("useLocalStorage", () => {
  it("starts with the initial value and hydrates to true", async () => {
    const { result } = renderHook(() =>
      useLocalStorage("k-init", { a: 1 })
    );
    // Initial value is the provided initialValue.
    expect(result.current[0]).toEqual({ a: 1 });
    // Under React 19 + RTL renderHook, the mount effect flushes during
    // render(), so the pre-effect hydrated:false state cannot be reliably
    // observed synchronously. Assert the stable post-hydration state instead.
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it("rehydrates a pre-seeded value", async () => {
    const stored = { count: 42, label: "x" };
    localStorage.setItem("k-seed", JSON.stringify(stored));

    const { result } = renderHook(() =>
      useLocalStorage("k-seed", { count: 0, label: "" })
    );

    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual(stored);
  });

  it("ignores corrupt JSON without throwing", async () => {
    localStorage.setItem("k-bad", "{not json");

    const { result } = renderHook(() =>
      useLocalStorage("k-bad", { safe: true })
    );

    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual({ safe: true });
  });

  it("set(value) updates state and persists JSON", async () => {
    const { result } = renderHook(() => useLocalStorage("k-set", 0));
    await waitFor(() => expect(result.current[2]).toBe(true));

    act(() => {
      result.current[1](7);
    });

    expect(result.current[0]).toBe(7);
    expect(JSON.parse(localStorage.getItem("k-set")!)).toBe(7);
  });

  it("set(updater) uses the previous value", async () => {
    const { result } = renderHook(() =>
      useLocalStorage<number>("k-upd", 0)
    );
    await waitFor(() => expect(result.current[2]).toBe(true));

    act(() => {
      result.current[1](10);
    });
    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
    expect(JSON.parse(localStorage.getItem("k-upd")!)).toBe(15);
  });

  it("set() は変更を同期層へ通知する（イベント＋dirty）", async () => {
    const { result } = renderHook(() => useLocalStorage("k-sync", 0));
    await waitFor(() => expect(result.current[2]).toBe(true));

    const fired = vi.fn();
    window.addEventListener(CHANGE_EVENT, fired);
    act(() => {
      result.current[1](1);
    });
    window.removeEventListener(CHANGE_EVENT, fired);

    expect(fired).toHaveBeenCalled();
    expect(localStorage.getItem(DIRTY_KEY)).toBe("1");
  });

  it("keeps two different keys independent", async () => {
    const { result: a } = renderHook(() => useLocalStorage("k-a", "a0"));
    const { result: b } = renderHook(() => useLocalStorage("k-b", "b0"));
    await waitFor(() => expect(a.current[2]).toBe(true));
    await waitFor(() => expect(b.current[2]).toBe(true));

    act(() => {
      a.current[1]("a-new");
    });

    expect(a.current[0]).toBe("a-new");
    expect(b.current[0]).toBe("b0");
    expect(localStorage.getItem("k-b")).toBeNull();
  });
});
