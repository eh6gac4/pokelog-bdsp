// pokelog-bdsp 同期 Worker。
// 同期コード（クライアント生成の高エントロピー文字列）が唯一の認証情報。
// コードは保存せず SHA-256 ハッシュを KV キーにする。ペイロードは
// { schema, updatedAt, party, log } の JSON スナップショット 1 件のみ。

// 依存を増やさないための最小型（@cloudflare/workers-types は使わない）。
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
export interface Env {
  SYNC_KV: KVNamespace;
  ALLOWED_ORIGIN?: string;
}

const CODE_RE = /^[A-Za-z0-9_-]{20,64}$/;
const MAX_BYTES = 256 * 1024;
const PATH_RE = /^\/v1\/sync\/([^/]+)$/;

function corsHeaders(env: Env): Record<string, string> {
  const allow =
    env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*"
      ? env.ALLOWED_ORIGIN
      : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

interface StoredSnapshot {
  schema: number;
  updatedAt: string;
  party: unknown;
  log: unknown;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const ch = corsHeaders(env);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: ch });
    }

    const url = new URL(req.url);
    const m = url.pathname.match(PATH_RE);
    if (!m) return json({ error: "not_found" }, 404, ch);

    const code = decodeURIComponent(m[1]);
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

      // 楽観的同時実行制御: client が知っている server 版 updatedAt を base
      // として送る。server 側が進んでいれば 409（別端末が更新済み）。
      const base = url.searchParams.get("base");
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
  },
};
