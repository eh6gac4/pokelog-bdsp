# Cloudflare Pages デプロイ

このアプリは全ルートがクライアント側のみ（`output: "export"`）。
`npm run build` で `out/` に静的書き出しし、Cloudflare Pages に配信する。
セキュリティ／`sw.js`／`apple-icon`／`manifest` のヘッダは
`public/_headers`（ビルドで `out/_headers` にコピー）で付与される。

- プロジェクト名: `pokelog-bdsp`
- 本番ブランチ: `main`
- 本番URL: `https://pokelog-bdsp.pages.dev`
- 同期 Worker: `https://pokelog-bdsp-sync.toshiki-cho-dev.workers.dev`
  （`next.config.ts` の `env.NEXT_PUBLIC_SYNC_URL` に baked-in）

## 手動デプロイ（API トークン・非対話）

```sh
source ~/.config/pokelog/cloudflare.env   # CLOUDFLARE_API_TOKEN / _ACCOUNT_ID
cd /path/to/pokelog-bdsp
npm run build
npx wrangler pages deploy out --project-name pokelog-bdsp --branch main
```

トークン最小スコープ: Account → Cloudflare Pages: Edit
（同期 Worker 用に Workers Scripts/KV: Edit も別途必要）。

## main マージで自動デプロイ（GitHub Actions）

`.github/workflows/deploy.yml` が `main` への push/マージで
単体テスト → `npm run build` → `wrangler pages deploy out` を実行する。
Cloudflare ダッシュボードでの Git 連携は不要。

### 必要な GitHub Secrets（初回のみ）

リポジトリに以下の 2 つを登録する:

- `CLOUDFLARE_API_TOKEN` — スコープ Account → Cloudflare Pages: Edit
  （CI 専用に新規発行を推奨。ローカル開発用トークンと分ける）
- `CLOUDFLARE_ACCOUNT_ID`

`gh` で登録する例（値はチャットに残さない運用）:

```sh
source ~/.config/pokelog/cloudflare.env
gh secret set CLOUDFLARE_API_TOKEN  --body "$CLOUDFLARE_API_TOKEN"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$CLOUDFLARE_ACCOUNT_ID"
```

> 推奨: CI 用は専用トークンを発行し、それを Secret に入れる。
> その後ローカルに残っている旧トークンはローテーション（無効化）する。

### 挙動

- `main` push/マージ → 本番（`https://pokelog-bdsp.pages.dev`）へデプロイ
- Actions タブから手動実行（`workflow_dispatch`）も可
- テストが落ちるとデプロイされない（壊れた main の公開防止）
- `concurrency` で同時実行は最新のみ

> CLI 直デプロイ（上記「手動デプロイ」）も併用可能だが、通常は
> Actions 経由に統一し、CLI は緊急時のフォールバックとする。

## オフライン PWA との関係

`sw.js` は `public/_headers` で `no-cache, no-store` 配信のため常に最新を取得。
アプリシェル（HTML/JS/CSS/フォント/アイコン）は SW がランタイムキャッシュし、
データは元々 localStorage。HTTPS 配信（pages.dev）で iPhone のホーム画面追加・
完全オフライン・同期コードによる端末間同期がすべて有効になる。
