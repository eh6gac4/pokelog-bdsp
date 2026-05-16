# pokelog-bdsp 同期 Worker

ローカル優先の旅パ／努力値ログを「同期コード」で複数端末共有するための
最小 Cloudflare Worker。データ層はクライアントの localStorage が真実の源で、
ここは JSON スナップショット 1 件を保管するだけ。

## API

- `GET /v1/sync/:code` → 保存済みスナップショット or `404`
- `PUT /v1/sync/:code[?base=<server側updatedAt>]` → 保存。`base` 指定時に
  サーバ側が進んでいれば `409 { error:"conflict", remote }`
- `OPTIONS` → CORS プリフライト

`:code` は `^[A-Za-z0-9_-]{20,64}$`。生コードは保存せず SHA-256 ハッシュを
KV キーにする。本文上限 256KB。

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
