// ブラウザ・Node・Workers 共通で使える同期プロトコルの純粋部。
// localStorage や window に触れず、fetch / TextEncoder / Date のみ使う。
// Web 側の `sync.ts` と、リポジトリ内 MCP サーバの双方から import される。

// MCP サーバ等のブラウザ外からも import するため相対パスを使う
// （`@/*` paths エイリアスを持たない実行環境でも解決可能にする）。
import type { Party } from "../types/party";
import type { PokemonEntry } from "../types/pokemon";
import { sha256Bytes, base64url } from "./sha256";

export const SNAPSHOT_SCHEMA = 1;

export interface Snapshot {
  schema: number;
  updatedAt: string;
  party: Party | null;
  log: PokemonEntry[];
}

export interface PushResult {
  ok: boolean;
  conflict?: boolean;
  remote?: Snapshot;
}

export const SYNC_CODE_MIN = 12;
export const SYNC_CODE_MAX = 256;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeSyncCode(raw: string): string {
  return raw.normalize("NFC").trim();
}

export function isValidSyncCode(code: string): boolean {
  const n = normalizeSyncCode(code);
  return n.length >= SYNC_CODE_MIN && n.length <= SYNC_CODE_MAX;
}

export function syncCodeStrength(code: string): "weak" | "ok" {
  const n = normalizeSyncCode(code);
  if (n.length >= 20) return "ok";
  if (n.length < 16) return "weak";
  let classes = 0;
  if (/[a-z]/.test(n)) classes++;
  if (/[A-Z]/.test(n)) classes++;
  if (/[0-9]/.test(n)) classes++;
  if (/[^A-Za-z0-9]/.test(n)) classes++;
  return classes >= 2 ? "ok" : "weak";
}

export function deriveSyncKey(rawCode: string): string {
  return base64url(sha256Bytes(normalizeSyncCode(rawCode)));
}

export function generateSyncCode(len = 24): string {
  // DOM の `Crypto` 型に依存せず、ブラウザ・Node・Workers すべてで動かす。
  const c =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
      : undefined;
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

function endpoint(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/v1/sync/${deriveSyncKey(code)}`;
}

export async function pullFrom(
  baseUrl: string,
  code: string,
): Promise<Snapshot | null> {
  const res = await fetch(endpoint(baseUrl, code), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  return (await res.json()) as Snapshot;
}

export async function pushTo(
  baseUrl: string,
  code: string,
  snap: Snapshot,
  base: string | null,
): Promise<PushResult> {
  const url =
    endpoint(baseUrl, code) +
    (base ? `?base=${encodeURIComponent(base)}` : "");
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
