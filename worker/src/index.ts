// pokelog-bdsp 同期 Worker + OAuth で保護した MCP サーバ。
//
// エンドポイント:
//   /v1/sync/:code              — 既存。ブラウザのクロスデバイス同期 (GET/PUT)。OAuth 非経路。
//   /mcp                        — Claude.ai 等の MCP クライアント向け。OAuth 必須。
//   /authorize                  — OAuth 同意画面（passphrase 入力）。
//   /token, /register, /.well-known/oauth-authorization-server
//                               — workers-oauth-provider が自動提供。
//   /admin/clients              — OAuth クライアント (=Claude.ai) を手動登録するための一回限り口。
//
// 旅パ本体は引き続き SYNC_KV に保管し、MCP もブラウザと同じスロットを参照する
// （kvKey = sha256(deriveSyncKey(MCP_SYNC_CODE))）。OAuth は「呼び出し元が
// あなた本人であること」だけを担保し、データ層には介入しない。

import OAuthProvider, {
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
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
import {
  deriveSyncKey,
  isValidSyncCode,
} from "../../src/lib/sync-core.ts";

export interface Env {
  SYNC_KV: KVNamespace;
  OAUTH_KV: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace<MyMCP>;
  ALLOWED_ORIGIN?: string;
  // wrangler secret put で設定する。未設定だと /authorize と /admin は 503。
  MCP_AUTH_PASSPHRASE?: string;  // /authorize 同意ページの入力値
  MCP_ADMIN_PASSPHRASE?: string; // /admin/clients を叩く時の合言葉
  MCP_SYNC_CODE?: string;        // 旅パの sync code（生合言葉、12〜256 文字）
}

// ===== 共有 =====

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
  headers: Record<string, string> = {},
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
  server = new McpServer({ name: "pokelog-bdsp", version: "0.2.0" });

  async init(): Promise<void> {
    const env = this.env;

    // MCP_SYNC_CODE は生合言葉。Web 側と同じ KV スロットを参照するため、
    // ブラウザが組み立てる URL と同じ二段で導出する:
    //   transfer = base64url(sha256(passphrase))      ← deriveSyncKey
    //   kvKey    = "sync:" + sha256_hex(transfer)     ← kvKeyFor
    const getKvKey = async (): Promise<string> => {
      const code = env.MCP_SYNC_CODE;
      if (!code || !isValidSyncCode(code)) {
        throw new Error(
          "MCP_SYNC_CODE is not configured or invalid (12–256 chars NFC)",
        );
      }
      return kvKeyFor(deriveSyncKey(code));
    };

    const pullSnap = async (): Promise<StoredSnapshot | null> => {
      const key = await getKvKey();
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
      const key = await getKvKey();
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

// ===== Default handler (OAuth 同意 + /v1/sync + /admin) =====

type DefaultEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

const app = new Hono<{ Bindings: DefaultEnv }>();

// 同意ページ
app.get("/authorize", async (c) => {
  if (!c.env.MCP_AUTH_PASSPHRASE) {
    return c.text("MCP_AUTH_PASSPHRASE not configured", 503);
  }
  let oauthReqInfo;
  try {
    oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  } catch (e) {
    return c.text(
      `Invalid OAuth request: ${e instanceof Error ? e.message : "unknown"}`,
      400,
    );
  }
  const client = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  if (!client) {
    return c.text("Unknown client_id", 400);
  }
  const stateJson = btoa(JSON.stringify(oauthReqInfo));
  return c.html(renderConsentPage({
    clientName: client.clientName ?? client.clientId,
    redirectUri: oauthReqInfo.redirectUri,
    scope: oauthReqInfo.scope,
    state: stateJson,
  }));
});

app.post("/authorize", async (c) => {
  if (!c.env.MCP_AUTH_PASSPHRASE) {
    return c.text("MCP_AUTH_PASSPHRASE not configured", 503);
  }
  const form = await c.req.raw.formData();
  const passphrase = String(form.get("passphrase") ?? "");
  const stateRaw = String(form.get("state") ?? "");
  if (!stateRaw) return c.text("Missing state", 400);

  // 平文比較。同一文字数で短絡を防ぐため明示的に定数時間比較する。
  if (!constantTimeEqual(passphrase, c.env.MCP_AUTH_PASSPHRASE)) {
    return c.html(
      renderConsentPage({
        clientName: "pokelog-bdsp",
        redirectUri: "",
        scope: [],
        state: stateRaw,
        error: "合言葉が違います",
      }),
      401,
    );
  }

  let oauthReqInfo;
  try {
    oauthReqInfo = JSON.parse(atob(stateRaw));
  } catch {
    return c.text("Invalid state", 400);
  }

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: "self",
    metadata: { label: "pokelog owner" },
    scope: oauthReqInfo.scope ?? [],
    props: {},
  });

  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  });
});

// 管理: OAuth クライアントの手動登録
app.post("/admin/clients", async (c) => {
  if (!c.env.MCP_ADMIN_PASSPHRASE) {
    return c.text("MCP_ADMIN_PASSPHRASE not configured", 503);
  }
  let body: unknown;
  try {
    body = await c.req.raw.json();
  } catch {
    return c.text("invalid JSON", 400);
  }
  const parsed = z.object({
    passphrase: z.string(),
    clientName: z.string().min(1),
    redirectUris: z.array(z.string().url()).min(1),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.format() }, 400);
  }
  if (!constantTimeEqual(parsed.data.passphrase, c.env.MCP_ADMIN_PASSPHRASE)) {
    return c.text("Unauthorized", 401);
  }
  const client = await c.env.OAUTH_PROVIDER.createClient({
    clientName: parsed.data.clientName,
    redirectUris: parsed.data.redirectUris,
    tokenEndpointAuthMethod: "client_secret_post",
  });
  // 注: clientSecret は平文返却されるのはこの 1 回きり（library 内部はハッシュ保管）。
  return c.json({
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    redirectUris: client.redirectUris,
    clientName: client.clientName,
    note: "clientSecret は今しか取得できない。安全な場所に保存して。",
  });
});

// 既存ブラウザ同期 API（OAuth 非経路）
app.all("/v1/sync/:rest{.*}", async (c) => {
  const ch = corsHeaders(c.env);
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: ch });
  }
  const m = c.req.path.match(PATH_RE);
  if (!m) return json({ error: "not_found" }, 404, ch);
  return handleSync(c.req.raw, c.env, ch, m[1]);
});

// 案内
app.get("/", (c) =>
  c.text(
    "pokelog-bdsp-sync: /v1/sync/:code (browser sync), /mcp (OAuth-protected MCP)",
  ),
);

// 404
app.all("*", (c) => c.text("Not found", 404));

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

function renderConsentPage(opts: {
  clientName: string;
  redirectUri: string;
  scope: readonly string[];
  state: string;
  error?: string;
}): string {
  const escape = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>pokelog-bdsp 認可</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; padding: 0 1rem; line-height: 1.6; }
  h1 { font-size: 1.25rem; }
  .client { background: #f5f5f5; padding: 0.75rem 1rem; border-radius: 6px; margin: 1rem 0; }
  .error { color: #b00; margin: 1rem 0; }
  label { display: block; margin: 1rem 0 0.25rem; font-weight: 600; }
  input[type=password] { width: 100%; padding: 0.5rem; font-size: 1rem; box-sizing: border-box; }
  button { margin-top: 1rem; padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }
</style></head><body>
<h1>旅パ MCP への接続を承認</h1>
<div class="client">
  <div><strong>${escape(opts.clientName)}</strong> が旅パの読み書き権限を要求しています。</div>
  ${opts.redirectUri ? `<div style="font-size:0.85rem;color:#666;margin-top:0.25rem;">callback: ${escape(opts.redirectUri)}</div>` : ""}
</div>
${opts.error ? `<div class="error">${escape(opts.error)}</div>` : ""}
<form method="post" action="/authorize">
  <label for="passphrase">合言葉 (MCP_AUTH_PASSPHRASE)</label>
  <input id="passphrase" name="passphrase" type="password" autofocus required>
  <input type="hidden" name="state" value="${escape(opts.state)}">
  <button type="submit">承認</button>
</form>
</body></html>`;
}

// ===== Default export: OAuth で保護された Worker =====

export default new OAuthProvider({
  // 公式 demo に倣い any キャスト。MyMCP.serve / Hono app はいずれも
  // { fetch(req, env, ctx) => Response } を満たすが、ライブラリ側が要求する
  // 型 (ExportedHandlerWithFetch / WorkerEntrypoint) と微妙に違うため。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiHandler: MyMCP.serve("/mcp") as any,
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  // Dynamic Client Registration も有効化。Claude.ai 側が DCR 対応なら自動登録、
  // しなければ /admin/clients で手動登録する（どちらでも動く）。/register は
  // 仕様上未認証だが、トークン発行には依然 MCP_AUTH_PASSPHRASE が必要。
  clientRegistrationEndpoint: "/register",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultHandler: app as any,
});
