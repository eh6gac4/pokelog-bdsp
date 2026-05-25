// pokelog-bdsp 同期 Worker + MCP サーバ。
//
// 同居しているエンドポイント:
//   /v1/sync/:code  — 既存。ブラウザのクロスデバイス同期 (GET/PUT)。
//   /mcp            — Claude.ai 等の MCP クライアント向け Streamable HTTP。
//   /sse            — レガシー SSE トランスポート（互換用）。
//
// /v1/sync は同期コードが唯一の認証情報という従来通りの設計。
// /mcp は Bearer トークン認証 + Worker secret に固定の sync code を埋める
// 単一テナント構成（個人利用前提）。
//
// 旅パの実体は KV (キー = SHA-256(sync code)) に置く。MCP は Durable
// Object でセッションを持つが、データは KV を直接 R/W する。
// よってブラウザ・MCP どちら経由で更新しても同じスナップショットに反映される。

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  emptyMoves,
  GAME_VERSIONS,
  NATURES,
  PARTY_MAX_MEMBERS,
  PARTY_MAX_MOVES,
  type GameVersion,
  type Party,
  type PartyMember,
} from "../../src/types/party.ts";
import {
  NATIONAL_DEX,
  lookupSpeciesId,
} from "../../src/lib/pokedex.ts";

export interface Env {
  SYNC_KV: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace<MyMCP>;
  ALLOWED_ORIGIN?: string;
  // wrangler secret put で設定する。両方とも未設定なら /mcp は 503 を返す。
  MCP_AUTH_TOKEN?: string;
  MCP_SYNC_CODE?: string;
}

// ===== 共有: 既存 sync API と MCP の両方が使うストレージ層 =====

const CODE_RE = /^[A-Za-z0-9_-]{20,64}$/;
const MAX_BYTES = 256 * 1024;
const PATH_RE = /^\/v1\/sync\/([^/]+)$/;

interface StoredSnapshot {
  schema: number;
  updatedAt: string;
  party: unknown;
  log: unknown;
}

function corsHeaders(env: Env): Record<string, string> {
  const allow =
    env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*"
      ? env.ALLOWED_ORIGIN
      : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  obj: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function kvKeyFor(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "sync:" + hex;
}

// ===== 既存 /v1/sync/:code ハンドラ =====

async function handleSync(
  req: Request,
  env: Env,
  ch: Record<string, string>,
  rawCode: string,
): Promise<Response> {
  const code = decodeURIComponent(rawCode);
  if (!CODE_RE.test(code)) {
    return json({ error: "invalid_code" }, 400, ch);
  }
  const key = await kvKeyFor(code);

  if (req.method === "GET") {
    const stored = await env.SYNC_KV.get(key);
    if (stored === null) return json({ error: "not_found" }, 404, ch);
    return new Response(stored, {
      status: 200,
      headers: { ...ch, "Content-Type": "application/json" },
    });
  }

  if (req.method === "PUT") {
    const body = await req.text();
    if (body.length > MAX_BYTES) {
      return json({ error: "payload_too_large" }, 413, ch);
    }
    let parsed: StoredSnapshot;
    try {
      parsed = JSON.parse(body) as StoredSnapshot;
    } catch {
      return json({ error: "invalid_json" }, 400, ch);
    }
    if (!parsed || typeof parsed.updatedAt !== "string") {
      return json({ error: "invalid_snapshot" }, 400, ch);
    }

    const base = new URL(req.url).searchParams.get("base");
    if (base !== null) {
      const existing = await env.SYNC_KV.get(key);
      if (existing) {
        try {
          const cur = JSON.parse(existing) as StoredSnapshot;
          if (cur.updatedAt !== base) {
            return json({ error: "conflict", remote: cur }, 409, ch);
          }
        } catch {
          // 壊れた既存値は上書きを許可
        }
      }
    }

    await env.SYNC_KV.put(key, JSON.stringify(parsed));
    return json({ ok: true, updatedAt: parsed.updatedAt }, 200, ch);
  }

  return json({ error: "method_not_allowed" }, 405, ch);
}

// ===== MCP =====

const ID_TO_NAME = new Map<number, string>(
  NATIONAL_DEX.map((e) => [e.id, e.name]),
);

function emptyParty(): Party {
  return { name: "", version: "bd", members: [] };
}

function normalizeMoves(moves: readonly string[] | undefined): string[] {
  const out = emptyMoves();
  if (!moves) return out;
  for (let i = 0; i < Math.min(moves.length, PARTY_MAX_MOVES); i++) {
    out[i] = String(moves[i] ?? "");
  }
  return out;
}

function ok(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function resolveSpecies(speciesName: string): { id: number; name: string } {
  const name = speciesName.trim();
  const id = lookupSpeciesId(name);
  if (id === undefined) {
    throw new Error(
      `unknown species: "${name}" (must be a Japanese pokemon name in National Dex #1–493)`,
    );
  }
  return { id, name };
}

function findMember(party: Party, id: string): PartyMember {
  const m = party.members.find((x) => x.id === id);
  if (!m) throw new Error(`member not found: ${id}`);
  return m;
}

export class MyMCP extends McpAgent<Env> {
  server = new McpServer({ name: "pokelog-bdsp", version: "0.1.0" });

  async init(): Promise<void> {
    const env = this.env;

    const getCode = (): string => {
      const code = env.MCP_SYNC_CODE;
      if (!code || !CODE_RE.test(code)) {
        throw new Error(
          "MCP_SYNC_CODE is not configured (set it via `wrangler secret put`)",
        );
      }
      return code;
    };

    const pullSnap = async (): Promise<StoredSnapshot | null> => {
      const key = await kvKeyFor(getCode());
      const raw = await env.SYNC_KV.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as StoredSnapshot;
    };

    type PushOk = { conflict: false };
    type PushConflict = { conflict: true; remote: StoredSnapshot };

    const pushSnap = async (
      snap: StoredSnapshot,
      base: string | null,
    ): Promise<PushOk | PushConflict> => {
      const key = await kvKeyFor(getCode());
      if (base !== null) {
        const existing = await env.SYNC_KV.get(key);
        if (existing) {
          try {
            const cur = JSON.parse(existing) as StoredSnapshot;
            if (cur.updatedAt !== base) {
              return { conflict: true, remote: cur };
            }
          } catch {
            // 壊れた既存値は上書きを許可
          }
        }
      }
      await env.SYNC_KV.put(key, JSON.stringify(snap));
      return { conflict: false };
    };

    /** pull → mutate → push を 409 で 1 回だけリトライ。 */
    const withParty = async (
      mutate: (party: Party) => Party,
    ): Promise<{ party: Party; updatedAt: string }> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const remote = await pullSnap();
        const baseUpdatedAt = remote?.updatedAt ?? null;
        const currentParty =
          (remote?.party as Party | null) ?? emptyParty();
        const nextParty = mutate(currentParty);
        const nextSnap: StoredSnapshot = {
          schema: 1,
          updatedAt: new Date().toISOString(),
          party: nextParty,
          log: (remote?.log as unknown[] | undefined) ?? [],
        };
        const res = await pushSnap(nextSnap, baseUpdatedAt);
        if (!res.conflict) {
          return { party: nextParty, updatedAt: nextSnap.updatedAt };
        }
      }
      throw new Error("push conflict persisted after retry");
    };

    // ----- Tools -----

    this.server.registerTool(
      "get_party",
      {
        title: "旅パを取得",
        description: "現在の旅パ全体（name, version, members[]）を返す。",
        inputSchema: {},
      },
      async () => {
        const snap = await pullSnap();
        const party = (snap?.party as Party | null) ?? emptyParty();
        return ok({ party, updatedAt: snap?.updatedAt ?? null });
      },
    );

    this.server.registerTool(
      "set_party_meta",
      {
        title: "旅パのメタ情報を更新",
        description:
          "旅パの name または version (bd/sp) を変更。指定したフィールドのみ更新。",
        inputSchema: {
          name: z.string().optional(),
          version: z.enum(GAME_VERSIONS).optional(),
        },
      },
      async ({ name, version }) => {
        if (name === undefined && version === undefined) {
          throw new Error("at least one of `name` or `version` is required");
        }
        const { party } = await withParty((p) => ({
          ...p,
          name: name ?? p.name,
          version: (version ?? p.version) as GameVersion,
        }));
        return ok({ party });
      },
    );

    this.server.registerTool(
      "add_member",
      {
        title: "メンバーを追加",
        description:
          "旅パにポケモンを 1 体追加。speciesName は和名（例: ゲンガー）。最大 6 体まで。",
        inputSchema: {
          speciesName: z.string().min(1),
          nickname: z.string().optional(),
          level: z.number().int().min(1).max(100).optional(),
          nature: z.enum(NATURES).optional(),
          ability: z.string().optional(),
          heldItem: z.string().optional(),
          moves: z.array(z.string()).max(PARTY_MAX_MOVES).optional(),
          notes: z.string().optional(),
        },
      },
      async (args) => {
        const sp = resolveSpecies(args.speciesName);
        const newMember: PartyMember = {
          id: crypto.randomUUID(),
          speciesId: sp.id,
          speciesName: sp.name,
          nickname: args.nickname ?? "",
          level: args.level ?? 1,
          nature: args.nature ?? "",
          ability: args.ability ?? "",
          heldItem: args.heldItem ?? "",
          moves: normalizeMoves(args.moves),
          notes: args.notes ?? "",
        };
        const { party } = await withParty((p) => {
          if (p.members.length >= PARTY_MAX_MEMBERS) {
            throw new Error(
              `party is already full (max ${PARTY_MAX_MEMBERS})`,
            );
          }
          return { ...p, members: [...p.members, newMember] };
        });
        return ok({ added: newMember, party });
      },
    );

    this.server.registerTool(
      "update_member",
      {
        title: "メンバーを更新",
        description:
          "id 指定で部分更新。speciesName を指定すると speciesId も自動解決。",
        inputSchema: {
          id: z.string().min(1),
          speciesName: z.string().optional(),
          nickname: z.string().optional(),
          level: z.number().int().min(1).max(100).optional(),
          nature: z.enum(NATURES).optional(),
          ability: z.string().optional(),
          heldItem: z.string().optional(),
          moves: z.array(z.string()).max(PARTY_MAX_MOVES).optional(),
          notes: z.string().optional(),
        },
      },
      async (args) => {
        const sp = args.speciesName ? resolveSpecies(args.speciesName) : null;
        const { party } = await withParty((p) => {
          const current = findMember(p, args.id);
          const updated: PartyMember = {
            ...current,
            ...(sp ? { speciesId: sp.id, speciesName: sp.name } : {}),
            ...(args.nickname !== undefined
              ? { nickname: args.nickname }
              : {}),
            ...(args.level !== undefined ? { level: args.level } : {}),
            ...(args.nature !== undefined ? { nature: args.nature } : {}),
            ...(args.ability !== undefined ? { ability: args.ability } : {}),
            ...(args.heldItem !== undefined
              ? { heldItem: args.heldItem }
              : {}),
            ...(args.moves !== undefined
              ? { moves: normalizeMoves(args.moves) }
              : {}),
            ...(args.notes !== undefined ? { notes: args.notes } : {}),
          };
          return {
            ...p,
            members: p.members.map((m) => (m.id === args.id ? updated : m)),
          };
        });
        return ok({
          updated: party.members.find((m) => m.id === args.id),
          party,
        });
      },
    );

    this.server.registerTool(
      "remove_member",
      {
        title: "メンバーを削除",
        description: "id 指定で旅パメンバーを 1 体削除。",
        inputSchema: { id: z.string().min(1) },
      },
      async ({ id }) => {
        const { party } = await withParty((p) => {
          findMember(p, id); // 存在チェック
          return { ...p, members: p.members.filter((m) => m.id !== id) };
        });
        return ok({ removed: id, party });
      },
    );

    this.server.registerTool(
      "lookup_species",
      {
        title: "ポケモン種族の検索",
        description:
          "和名→ID または ID→和名を引く。Gen 1–4 (#1〜#493) のみ。",
        inputSchema: {
          name: z.string().optional(),
          id: z.number().int().min(1).max(493).optional(),
        },
      },
      async ({ name, id }) => {
        if (name === undefined && id === undefined) {
          throw new Error("either `name` or `id` is required");
        }
        if (name !== undefined) {
          const got = lookupSpeciesId(name);
          return ok(
            got === undefined
              ? { found: false, query: name }
              : { found: true, id: got, name: ID_TO_NAME.get(got) ?? name },
          );
        }
        const n = ID_TO_NAME.get(id!);
        return ok(
          n === undefined
            ? { found: false, query: id }
            : { found: true, id, name: n },
        );
      },
    );
  }
}

// ===== Top-level fetch dispatcher =====

function checkMcpAuth(req: Request, env: Env): Response | null {
  if (!env.MCP_AUTH_TOKEN || !env.MCP_SYNC_CODE) {
    return new Response(
      "MCP not configured (set MCP_AUTH_TOKEN and MCP_SYNC_CODE)",
      { status: 503 },
    );
  }
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== env.MCP_AUTH_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(req.url);
    const ch = corsHeaders(env);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: ch });
    }

    // MCP (Streamable HTTP)
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const unauth = checkMcpAuth(req, env);
      if (unauth) return unauth;
      return MyMCP.serve("/mcp").fetch(req, env, ctx);
    }

    // MCP (legacy SSE トランスポート)
    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      const unauth = checkMcpAuth(req, env);
      if (unauth) return unauth;
      return MyMCP.serveSSE("/sse").fetch(req, env, ctx);
    }

    // 既存の sync API
    const m = url.pathname.match(PATH_RE);
    if (m) {
      return handleSync(req, env, ch, m[1]);
    }

    return json({ error: "not_found" }, 404, ch);
  },
};
