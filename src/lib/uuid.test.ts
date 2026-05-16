import { afterEach, describe, expect, it, vi } from "vitest";
import { randomId } from "./uuid";

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available (secure context / localhost)", () => {
    const spy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-1111-4111-8111-111111111111");
    expect(randomId()).toBe("11111111-1111-4111-8111-111111111111");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to getRandomValues v4 when randomUUID is absent (non-secure HTTP origin)", () => {
    // Simulate a non-secure context: randomUUID undefined, getRandomValues present.
    vi.stubGlobal("crypto", {
      getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
        const u8 = arr as unknown as Uint8Array;
        for (let i = 0; i < u8.length; i++) u8[i] = (i * 17 + 7) & 0xff;
        return arr;
      },
    });
    const id = randomId();
    expect(id).toMatch(V4);
    // version nibble is 4, variant nibble in [8,9,a,b]
    expect(id[14]).toBe("4");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("produces unique ids and valid v4 format across many calls", () => {
    const ids = new Set(Array.from({ length: 500 }, () => randomId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it("still returns a v4-shaped id when no crypto is available at all", () => {
    vi.stubGlobal("crypto", undefined);
    expect(randomId()).toMatch(V4);
  });
});
