import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SYNC_CODE_RE,
  CHANGE_EVENT,
  PARTY_KEY,
  LOG_KEY,
  DIRTY_KEY,
  SYNC_BASE_KEY,
  SYNC_CODE_KEY,
  isDirty,
  generateSyncCode,
  isValidSyncCode,
  buildSnapshot,
  applySnapshot,
  markChanged,
  pull,
  push,
  runSync,
  connectWithCode,
  syncConfigured,
  type Snapshot,
} from "./sync";

function res(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function snap(updatedAt: string, partyName = "p"): Snapshot {
  return {
    schema: 1,
    updatedAt,
    party: { name: partyName, version: "bd", members: [] },
    log: [],
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SYNC_URL", "https://sync.test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sync code", () => {
  it("generateSyncCode は規定の正規表現を満たす", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateSyncCode();
      expect(c).toHaveLength(24);
      expect(SYNC_CODE_RE.test(c)).toBe(true);
      expect(isValidSyncCode(c)).toBe(true);
    }
  });
  it("isValidSyncCode は短すぎ/不正文字を弾く", () => {
    expect(isValidSyncCode("short")).toBe(false);
    expect(isValidSyncCode("あ".repeat(24))).toBe(false);
    expect(isValidSyncCode("A".repeat(20))).toBe(true);
  });
});

describe("snapshot build/apply", () => {
  it("party/log を round-trip し updatedAt は ISO、apply で dirty クリア", () => {
    localStorage.setItem(
      PARTY_KEY,
      JSON.stringify({ name: "旅", version: "sp", members: [] }),
    );
    localStorage.setItem(LOG_KEY, JSON.stringify([]));

    const s = buildSnapshot();
    expect(s.party).toEqual({ name: "旅", version: "sp", members: [] });
    expect(new Date(s.updatedAt).toISOString()).toBe(s.updatedAt);

    localStorage.clear();
    localStorage.setItem(DIRTY_KEY, "1");
    applySnapshot(s);
    expect(JSON.parse(localStorage.getItem(PARTY_KEY)!).name).toBe("旅");
    expect(isDirty()).toBe(false);
  });

  it("markChanged は dirty を立て変更イベントを発火", () => {
    const fired = vi.fn();
    window.addEventListener(CHANGE_EVENT, fired);
    markChanged();
    expect(localStorage.getItem(DIRTY_KEY)).toBe("1");
    expect(isDirty()).toBe(true);
    expect(fired).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHANGE_EVENT, fired);
  });
});

describe("pull / push", () => {
  it("pull: 404 は null、200 は snapshot、その他は throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(res(404, {})));
    expect(await pull("A".repeat(24))).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(res(200, snap("2026-01-01T00:00:00Z"))),
    );
    expect((await pull("A".repeat(24)))!.updatedAt).toBe(
      "2026-01-01T00:00:00Z",
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(res(500, {})));
    await expect(pull("A".repeat(24))).rejects.toThrow();
  });

  it("push: 200 は ok、409 は conflict+remote", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(res(200, { ok: true })));
    expect((await push("A".repeat(24), snap("t"), null)).ok).toBe(true);

    const remote = snap("2026-02-02T00:00:00Z", "remote");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(res(409, { error: "conflict", remote })),
    );
    const r = await push("A".repeat(24), snap("t"), "base");
    expect(r.conflict).toBe(true);
    expect(r.remote!.party!.name).toBe("remote");
  });
});

describe("runSync", () => {
  const CODE = "A".repeat(24);

  beforeEach(() => {
    localStorage.setItem(SYNC_CODE_KEY, CODE);
  });

  it("未設定なら idle", async () => {
    vi.stubEnv("NEXT_PUBLIC_SYNC_URL", "");
    expect(syncConfigured()).toBe(false);
    expect((await runSync()).status).toBe("idle");
  });

  it("サーバ未保存ならローカルを push し dirty クリア", async () => {
    localStorage.setItem(DIRTY_KEY, "1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(404, {})) // pull
      .mockResolvedValueOnce(res(200, { ok: true })); // push
    vi.stubGlobal("fetch", fetchMock);

    expect((await runSync()).status).toBe("pushed");
    expect(localStorage.getItem(SYNC_BASE_KEY)).toBeTruthy();
    expect(isDirty()).toBe(false);
  });

  it("dirty 無し・サーバ未変更なら noop", async () => {
    localStorage.setItem(SYNC_BASE_KEY, "2026-01-01T00:00:00Z");
    const remote = snap("2026-01-01T00:00:00Z", "same");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(res(200, remote)));
    expect((await runSync()).status).toBe("noop");
  });

  it("サーバ更新あり・dirty 無しなら pull して反映", async () => {
    localStorage.setItem(SYNC_BASE_KEY, "2026-01-01T00:00:00Z");
    const remote = snap("2026-03-03T00:00:00Z", "fromServer");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(res(200, remote)));

    expect((await runSync()).status).toBe("pulled");
    expect(JSON.parse(localStorage.getItem(PARTY_KEY)!).name).toBe(
      "fromServer",
    );
  });

  it("双方変更(dirty有+サーバ更新)で confirm=true ならリモート採用", async () => {
    localStorage.setItem(SYNC_BASE_KEY, "2026-01-01T00:00:00Z");
    localStorage.setItem(DIRTY_KEY, "1");
    const remote = snap("2026-03-03T00:00:00Z", "fromServer");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(res(200, remote)));

    const r = await runSync({ confirmConflict: () => true });
    expect(r.status).toBe("conflict-remote");
    expect(JSON.parse(localStorage.getItem(PARTY_KEY)!).name).toBe(
      "fromServer",
    );
    expect(isDirty()).toBe(false);
  });

  it("双方変更で confirm=false ならローカルで上書き", async () => {
    localStorage.setItem(SYNC_BASE_KEY, "2026-01-01T00:00:00Z");
    localStorage.setItem(DIRTY_KEY, "1");
    localStorage.setItem(
      PARTY_KEY,
      JSON.stringify({ name: "local", version: "bd", members: [] }),
    );
    const remote = snap("2026-03-03T00:00:00Z", "fromServer");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, remote)) // pull
      .mockResolvedValueOnce(res(200, { ok: true })); // overwrite push
    vi.stubGlobal("fetch", fetchMock);

    const r = await runSync({ confirmConflict: () => false });
    expect(r.status).toBe("conflict-local");
    expect(JSON.parse(localStorage.getItem(PARTY_KEY)!).name).toBe("local");
    expect(isDirty()).toBe(false);
  });
});

describe("connectWithCode", () => {
  it("サーバに既存があれば取り込む", async () => {
    const remote = snap("2026-05-05T00:00:00Z", "joined");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(res(200, remote)));
    const r = await connectWithCode("B".repeat(24));
    expect(r.status).toBe("pulled");
    expect(JSON.parse(localStorage.getItem(PARTY_KEY)!).name).toBe("joined");
  });

  it("サーバ未保存ならローカルを初期 push", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(404, {}))
      .mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await connectWithCode("C".repeat(24));
    expect(r.status).toBe("pushed");
    expect(localStorage.getItem(SYNC_CODE_KEY)).toBe("C".repeat(24));
  });
});
