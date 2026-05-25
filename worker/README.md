# pokelog-bdsp 同期 Worker

ローカル優先の旅パ／努力値ログを「同期コード」で複数端末共有するための
最小 Cloudflare Worker。データ層はクライアントの localStorage が真実の源で、
ここは JSON スナップショット 1 件を保管するだけ。

Claude.ai 等の MCP クライアントから旅パを読み書きするための `/mcp`
エンドポイントも同じ Worker に同居している（Durable Object でセッション管理、
データ本体は同じ KV）。

## API

### 同期 (ブラウザ ↔ Worker)

- `GET /v1/sync/:code` → 保存済みスナップショット or `404`
- `PUT /v1/sync/:code[?base=<server側updatedAt>]` → 保存。`base` 指定時に
  サーバ側が進んでいれば `409 { error:"conflict", remote }`
- `OPTIONS` → CORS プリフライト

`:code` は `^[A-Za-z0-9_-]{20,64}$`。生コードは保存せず SHA-256 ハッシュを
KV キーにする。本文上限 256KB。

### MCP (Claude.ai connector 等から接続)

- `POST /mcp` → MCP Streamable HTTP (推奨)
- `GET/POST /sse` → MCP SSE (レガシー互換)

両方とも `Authorization: Bearer <MCP_AUTH_TOKEN>` が必須。未設定時は 503。
シークレット未設定の本番デプロイで `/mcp` を晒したくない場合は、デプロイ前に
かならず secret を設定する。

公開ツール: `get_party`, `set_party_meta`, `add_member`, `update_member`,
`remove_member`, `lookup_species`。実装は `src/index.ts` の `MyMCP` クラス。

## デプロイ（API トークン・非対話）

`wrangler login` は使わず環境変数で認証する。

```sh
source ~/.config/pokelog/cloudflare.env   # CLOUDFLARE_API_TOKEN / _ACCOUNT_ID
cd worker

# 1. KV namespace を作成し、出力の id を wrangler.toml の
#    [[kv_namespaces]] id に貼る
npx wrangler kv namespace create SYNC_KV

# 2. デプロイ
npx wrangler deploy
```

トークン最小スコープ: Account → Workers Scripts: Edit ＋
Account → Workers KV Storage: Edit。

デプロイ後の `https://pokelog-bdsp-sync.<subdomain>.workers.dev` を
Next 側の `NEXT_PUBLIC_SYNC_URL` に設定する（末尾スラッシュ無し）。

## MCP の有効化（Claude.ai connector で使う場合）

`/mcp` を本番で使うには、Worker secret を 2 つ設定する。

```sh
cd worker
# 任意の高エントロピー文字列（Bearer トークン）。一度だけ表示・保管する。
echo "$(openssl rand -base64 32)" | npx wrangler secret put MCP_AUTH_TOKEN
# Web 側で表示されている同期コード（この MCP が読み書きする旅パを決める）
npx wrangler secret put MCP_SYNC_CODE
npx wrangler deploy
```

Claude.ai 側:

1. Settings → Connectors → Add custom connector
2. URL: `https://pokelog-bdsp-sync.<subdomain>.workers.dev/mcp`
3. Authentication: Custom header → `Authorization: Bearer <MCP_AUTH_TOKEN の値>`

接続後は `mcp__<connector_name>__get_party` 等のツール名でチャットから呼べる。
変更はブラウザの自動同期エンジンが pull するので、Web 側にも反映される。

### 注意

- MCP は **単一テナント** 構成（一つの sync code に固定）。複数の旅パを
  使い分けたいなら、Worker をもう一台デプロイして別の secret を設定する。
- `MCP_AUTH_TOKEN` は connector 設定からしか復元できないので、紛失したら
  `wrangler secret put` で更新 → Claude.ai 側も差し替える。
- `MCP_SYNC_CODE` は Web 側の合言葉そのもの。secret から漏れたら自分の
  旅パが他人に編集可能になる扱いなので、token と同じ重みで管理する。

## ローカル確認

```sh
source ~/.config/pokelog/cloudflare.env
cd worker && npx wrangler dev
# 別シェルで:
CODE=ABCDEFGHJKMNPQRSTUVWX
curl -s localhost:8787/v1/sync/$CODE            # 404
curl -s -XPUT localhost:8787/v1/sync/$CODE \
  -H 'content-type: application/json' \
  -d '{"schema":1,"updatedAt":"2026-01-01T00:00:00.000Z","party":null,"log":[]}'
curl -s localhost:8787/v1/sync/$CODE            # 保存済みが返る
```

`/mcp` のローカル確認は `.dev.vars` に `MCP_AUTH_TOKEN` と `MCP_SYNC_CODE` を
書いてから `wrangler dev`。

```sh
cat > .dev.vars <<'EOF'
MCP_AUTH_TOKEN=local-dev-token
MCP_SYNC_CODE=ABCDEFGHJKMNPQRSTUVWX
EOF
npx wrangler dev
# 別シェルで initialize → tools/list:
curl -s -XPOST localhost:8787/mcp \
  -H 'Authorization: Bearer local-dev-token' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```
