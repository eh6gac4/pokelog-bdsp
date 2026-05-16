// ローカル優先のクロスデバイス同期。localStorage が真実の源で、
// サーバ（Cloudflare Worker）は JSON スナップショット 1 件の保管庫。
// 同期コードが唯一の認証情報（高エントロピー・共有秘密）。

import type { Party } from "@/types/party";
import type { PokemonEntry } from "@/types/pokemon";

// useParty / usePokemonLog と同じ localStorage キー。
export const PARTY_KEY = "pokelog-bdsp-party-v1";
export const LOG_KEY = "pokelog-bdsp-v1";

// 同期メタ（useLocalStorage を経由しない＝変更イベントを起こさない）。
export const SYNC_CODE_KEY = "pokelog-bdsp-sync-code-v1";
export const SYNC_BASE_KEY = "pokelog-bdsp-sync-base-v1"; // 最後に同期したサーバ updatedAt
export const DIRTY_KEY = "pokelog-bdsp-dirty-v1"; // 最後の同期以降に未送信変更があるか

export const CHANGE_EVENT = "pokelog:changed";
export const SNAPSHOT_SCHEMA = 1;

export interface Snapshot {
  schema: number;
  updatedAt: string;
  party: Party | null;
  log: PokemonEntry[];
}

// 遅延解決（テストで env を差し替え可能にするため定数化しない）。
function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SYNC_URL ?? "").replace(/\/+$/, "");
}

/** 同期バックエンド URL が設定済みか（未設定なら UI を出さない）。 */
export function syncConfigured(): boolean {
  return baseUrl().length > 0;
}

// 紛らわしい文字（0/O/1/I/l）を除いた 31 文字。Worker 側の
// `^[A-Za-z0-9_-]{20,64}$` を満たす。
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SYNC_CODE_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isValidSyncCode(code: string): boolean {
  return SYNC_CODE_RE.test(code);
}

export function generateSyncCode(len = 24): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  const out: string[] = [];
  if (c && typeof c.getRandomValues === "function") {
    const buf = c.getRandomValues(new Uint8Array(len));
    for (let i = 0; i < len; i++) {
      out.push(CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]);
    }
  } else {
    for (let i = 0; i < len; i++) {
      out.push(CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0]);
    }
  }
  return out.join("");
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * 現在のローカルデータからスナップショットを構築。
 * `updatedAt` は呼び出し時刻（＝push する版の識別子）。Date 生成は
 * 同期時のみ行い、データ変更の hot path には乗せない。
 */
export function buildSnapshot(): Snapshot {
  return {
    schema: SNAPSHOT_SCHEMA,
    updatedAt: new Date().toISOString(),
    party: readJSON<Party | null>(PARTY_KEY, null),
    log: readJSON<PokemonEntry[]>(LOG_KEY, []),
  };
}

/** 受信スナップショットをローカルへ反映（直接書込み＝再帰的な変更通知なし）。 */
export function applySnapshot(snap: Snapshot): void {
  if (snap.party !== null) {
    localStorage.setItem(PARTY_KEY, JSON.stringify(snap.party));
  }
  localStorage.setItem(LOG_KEY, JSON.stringify(snap.log ?? []));
  // サーバ内容を取り込んだのでローカルは「未送信変更なし」状態。
  clearDirty();
}

// --- 未送信変更フラグ ---
export function isDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}
function setDirty(): void {
  try {
    localStorage.setItem(DIRTY_KEY, "1");
  } catch {
    /* ignore */
  }
}
function clearDirty(): void {
  try {
    localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* ignore */
  }
}

// --- 同期メタのアクセサ ---
export function getSyncCode(): string | null {
  try {
    return localStorage.getItem(SYNC_CODE_KEY);
  } catch {
    return null;
  }
}
export function setSyncCode(code: string): void {
  try {
    localStorage.setItem(SYNC_CODE_KEY, code);
  } catch {
    /* ignore */
  }
}
export function clearSyncCode(): void {
  try {
    localStorage.removeItem(SYNC_CODE_KEY);
    localStorage.removeItem(SYNC_BASE_KEY);
  } catch {
    /* ignore */
  }
}
export function getSyncBase(): string | null {
  try {
    return localStorage.getItem(SYNC_BASE_KEY);
  } catch {
    return null;
  }
}
export function setSyncBase(updatedAt: string): void {
  try {
    localStorage.setItem(SYNC_BASE_KEY, updatedAt);
  } catch {
    /* ignore */
  }
}

/**
 * データ変更を記録し変更イベントを発火（SyncManager がデバウンス push）。
 * Date を使わない＝フック側の Date モックや hot path に干渉しない。
 */
export function markChanged(): void {
  setDirty();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

function endpoint(code: string): string {
  return `${baseUrl()}/v1/sync/${encodeURIComponent(code)}`;
}

export async function pull(code: string): Promise<Snapshot | null> {
  const res = await fetch(endpoint(code), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  return (await res.json()) as Snapshot;
}

export interface PushResult {
  ok: boolean;
  conflict?: boolean;
  remote?: Snapshot;
}

export async function push(
  code: string,
  snap: Snapshot,
  base: string | null,
): Promise<PushResult> {
  const url =
    endpoint(code) + (base ? `?base=${encodeURIComponent(base)}` : "");
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snap),
  });
  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as {
      remote?: Snapshot;
    };
    return { ok: false, conflict: true, remote: body.remote };
  }
  if (!res.ok) throw new Error(`push failed: ${res.status}`);
  return { ok: true };
}

// --- 同期エンジン ---

export type SyncStatus =
  | "idle" // 未設定/コード無し
  | "noop" // 変更なし
  | "pushed" // ローカル→サーバ反映
  | "pulled" // サーバ→ローカル反映（呼び出し側でリロード）
  | "conflict-remote" // 競合: リモート採用（リロード）
  | "conflict-local" // 競合: ローカル優先（サーバ上書き）
  | "error";

export interface SyncOutcome {
  status: SyncStatus;
  error?: unknown;
}

export interface RunSyncOpts {
  // true=リモート採用 / false=ローカル優先。未指定時は安全側でリモート採用。
  confirmConflict?: () => boolean;
}

let inFlight: Promise<SyncOutcome> | null = null;

async function resolveConflict(
  code: string,
  local: Snapshot,
  remote: Snapshot,
  opts: RunSyncOpts,
): Promise<SyncOutcome> {
  const takeRemote = opts.confirmConflict ? opts.confirmConflict() : true;
  if (takeRemote) {
    applySnapshot(remote); // dirty クリア込み
    setSyncBase(remote.updatedAt);
    return { status: "conflict-remote" };
  }
  try {
    // remote.updatedAt を base にして必ず通す（ローカル優先の上書き）。
    const r = await push(code, local, remote.updatedAt);
    if (r.conflict) {
      return { status: "error", error: new Error("conflict_loop") };
    }
    setSyncBase(local.updatedAt);
    clearDirty();
    return { status: "conflict-local" };
  } catch (error) {
    return { status: "error", error };
  }
}

async function doRunSync(opts: RunSyncOpts): Promise<SyncOutcome> {
  if (!syncConfigured()) return { status: "idle" };
  const code = getSyncCode();
  if (!code || !isValidSyncCode(code)) return { status: "idle" };

  const local = buildSnapshot();
  const base = getSyncBase();

  let remote: Snapshot | null;
  try {
    remote = await pull(code);
  } catch (error) {
    return { status: "error", error };
  }

  if (remote === null) {
    try {
      await push(code, local, null);
      setSyncBase(local.updatedAt);
      clearDirty();
      return { status: "pushed" };
    } catch (error) {
      return { status: "error", error };
    }
  }

  const localChanged = isDirty();
  const remoteChanged = remote.updatedAt !== base;

  if (!remoteChanged) {
    if (!localChanged) return { status: "noop" };
    try {
      const r = await push(code, local, base);
      if (r.conflict) {
        return resolveConflict(code, local, r.remote ?? remote, opts);
      }
      setSyncBase(local.updatedAt);
      clearDirty();
      return { status: "pushed" };
    } catch (error) {
      return { status: "error", error };
    }
  }

  if (!localChanged) {
    applySnapshot(remote); // dirty クリア込み
    setSyncBase(remote.updatedAt);
    return { status: "pulled" };
  }

  return resolveConflict(code, local, remote, opts);
}

/** 多重実行を抑止しつつ同期を一回実行。 */
export function runSync(opts: RunSyncOpts = {}): Promise<SyncOutcome> {
  if (inFlight) return inFlight;
  inFlight = doRunSync(opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * コードで接続（生成 or 別端末コード入力の両対応）。
 * サーバに既存があれば取り込み（"pulled"）、無ければローカルを初期 push。
 */
export async function connectWithCode(code: string): Promise<SyncOutcome> {
  if (!syncConfigured()) return { status: "idle" };
  if (!isValidSyncCode(code)) {
    return { status: "error", error: new Error("invalid_code") };
  }
  setSyncCode(code);
  let remote: Snapshot | null;
  try {
    remote = await pull(code);
  } catch (error) {
    return { status: "error", error };
  }
  if (remote !== null) {
    applySnapshot(remote); // dirty クリア込み
    setSyncBase(remote.updatedAt);
    return { status: "pulled" };
  }
  try {
    const local = buildSnapshot();
    await push(code, local, null);
    setSyncBase(local.updatedAt);
    clearDirty();
    return { status: "pushed" };
  } catch (error) {
    return { status: "error", error };
  }
}

export function disconnectSync(): void {
  clearSyncCode();
}
