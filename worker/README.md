# pokelog-bdsp 同期 Worker

ローカル優先の旅パ／努力値ログを「同期コード」で複数端末共有するための
Cloudflare Worker。データ層はクライアントの localStorage が真実の源で、
ここは JSON スナップショット 1 件を保管するだけ。

同じ Worker に Claude.ai 等のリモート MCP クライアント向けの `/mcp`
エンドポイントが同居していて、こちらは OAuth 2.1 で保護されている。
MCP 経由の更新もブラウザと同じ KV スロットに書くので、ブラウザの自動同期
エンジンが pull することで Web 側に反映される。

## エンドポイント

| Path | 用途 | 認証 |
|---|---|---|
| `GET/PUT /v1/sync/:code` | ブラウザのクロスデバイス同期 | sync code (URL に含まれる転送キー) |
| `POST /mcp` | MCP Streamable HTTP | OAuth 2.1 Bearer access_token |
| `GET/POST /authorize` | 同意ページ（passphrase 入力） | MCP_AUTH_PASSPHRASE |
| `POST/GET /token` | OAuth トークン発行・更新 | workers-oauth-provider が処理 |
| `POST /register` | OAuth Dynamic Client Registration | （未認証。仕様準拠） |
| `GET /.well-known/oauth-authorization-server` | OAuth Discovery | 公開 |
| `POST /admin/clients` | クライアント手動登録（DCR 不使用クライアント向け） | MCP_ADMIN_PASSPHRASE |

`/v1/sync/:code` の仕様:
- `GET` → 保存済みスナップショット or `404`
- `PUT[?base=<server側updatedAt>]` → 保存。`base` 指定時にサーバが進んでいれば
  `409 { error:"conflict", remote }`
- `:code` は `^[A-Za-z0-9_-]{20,64}$`（生コードは保存せず SHA-256 ハッシュを KV キーに）
- 本文上限 256KB

`/mcp` の公開ツール: `get_party`, `set_party_meta`, `add_member`, `update_member`,
`remove_member`, `lookup_species`。実装は `src/index.ts` の `MyMCP` クラス。

## 初回デプロイ

`wrangler login` は使わず環境変数で認証する。

```sh
source ~/.config/pokelog/cloudflare.env   # CLOUDFLARE_API_TOKEN / _ACCOUNT_ID
cd worker
npm install

# 1. KV namespace を 2 つ作って、それぞれの id を wrangler.toml に貼る
npx wrangler kv namespace create SYNC_KV    # ブラウザ同期データ
npx wrangler kv namespace create OAUTH_KV   # OAuth クライアント・トークン

# 2. MCP を使う場合の secret 設定（使わないなら省略可、未設定だと /mcp は 503）
echo -n "$(openssl rand -base64 32)" | npx wrangler secret put MCP_AUTH_PASSPHRASE
echo -n "$(openssl rand -base64 32)" | npx wrangler secret put MCP_ADMIN_PASSPHRASE
npx wrangler secret put MCP_SYNC_CODE       # Web 側の合言葉そのまま

# 3. デプロイ
npx wrangler deploy
```

トークン最小スコープ: Account → Workers Scripts: Edit ＋
Account → Workers KV Storage: Edit。

デプロイ後の `https://pokelog-bdsp-sync.<subdomain>.workers.dev` を
Next 側の `NEXT_PUBLIC_SYNC_URL` に設定する（末尾スラッシュ無し）。

## MCP を Claude.ai connector で使う

### A. Dynamic Client Registration が使える場合（推奨）

Claude.ai → Settings → Connectors → Add custom connector:

- **MCP Server URL**: `https://pokelog-bdsp-sync.<subdomain>.workers.dev/mcp`
- **OAuth Client ID / Secret**: 空のまま保存

Claude.ai が `/register` で自己登録する。接続ボタンを押すと `/authorize`
の HTML ページに飛ぶので、そこに `MCP_AUTH_PASSPHRASE` を入力して承認。
以降はアクセストークン・リフレッシュトークンを Claude.ai が自動管理する。

### B. 手動 client 登録が必要な場合（Claude.ai が DCR 非対応の時）

`/admin/clients` で事前登録して client_id / client_secret を取得する。
redirect_uri は Claude.ai の connector 設定 UI に表示されている値。

```sh
curl -sX POST https://pokelog-bdsp-sync.<subdomain>.workers.dev/admin/clients \
  -H 'Content-Type: application/json' \
  -d '{
    "passphrase": "'"$MCP_ADMIN_PASSPHRASE"'",
    "clientName": "claude.ai",
    "redirectUris": ["https://claude.ai/.../callback"]
  }'
# => { "clientId": "...", "clientSecret": "...", ... }
```

レスポンスの client_id / client_secret を Claude.ai の connector フォームに入力。

### 注意

- **単一テナント**構成（一つの sync code に固定）。複数の旅パを使い分けるなら
  Worker をもう一台デプロイして別の secret を設定する。
- `MCP_AUTH_PASSPHRASE` は `/authorize` 同意ページの入力値（=本人確認）。
  漏れたら自分の旅パが他人に編集可能になる扱いなので、強い値にする。
- `MCP_ADMIN_PASSPHRASE` は `/admin/clients` を叩く時の合言葉。OAuth クライアントを
  勝手に作られないため。`MCP_AUTH_PASSPHRASE` とは別の値にする。
- `MCP_SYNC_CODE` は Web 側の合言葉そのもの（生文字列）。MCP が読み書きする
  KV スロットを決める。
- secret を更新したら `wrangler deploy` 不要（即時反映）だが、既存のアクセス
  トークンは無効化されないので、必要なら OAUTH_KV から `token:*` `grant:*` を
  削除する。

## ローカル確認

```sh
source ~/.config/pokelog/cloudflare.env
cd worker
cat > .dev.vars <<'EOF'
MCP_AUTH_PASSPHRASE=local-dev-passphrase-12chars
MCP_ADMIN_PASSPHRASE=local-dev-admin-12chars
MCP_SYNC_CODE=pokelog-localtest
EOF
npx wrangler dev
```

別シェルで:

```sh
# 同期 API（OAuth 非経路）
CODE=ABCDEFGHJKMNPQRSTUVWX
curl -s localhost:8787/v1/sync/$CODE            # 404
curl -s -XPUT localhost:8787/v1/sync/$CODE \
  -H 'content-type: application/json' \
  -d '{"schema":1,"updatedAt":"2026-01-01T00:00:00.000Z","party":null,"log":[]}'
curl -s localhost:8787/v1/sync/$CODE            # 保存済みが返る

# OAuth discovery
curl -s localhost:8787/.well-known/oauth-authorization-server

# /mcp はトークン無しだと 401
curl -sI -XPOST localhost:8787/mcp                       # → HTTP/1.1 401

# クライアント手動登録
curl -sX POST localhost:8787/admin/clients \
  -H 'Content-Type: application/json' \
  -d '{"passphrase":"local-dev-admin-12chars","clientName":"local-test","redirectUris":["https://example.com/cb"]}'
```

OAuth dance の完全 e2e テストは Claude Desktop の Inspector を使うのが楽。
直接 curl で完走させる場合は PKCE 計算が要る。
