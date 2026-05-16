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

## main マージで自動デプロイ（GitHub 連携・要ダッシュボード操作）

CLI では GitHub 連携を作成できないため、初回のみ Cloudflare ダッシュボードで設定する。

1. Cloudflare ダッシュボード → **Workers & Pages** → 既存の
   **`pokelog-bdsp`** プロジェクトを開く（CLI 直デプロイで作成済み）。
2. **Settings → Builds & deployments → Connect to Git** で
   GitHub の `eh6gac4/pokelog-bdsp` を認可・接続。
3. ビルド設定:
   - Production branch: `main`
   - Framework preset: `None`（Next.js プリセットは SSR 前提なので使わない）
   - Build command: `npm run build`
   - Build output directory: `out`
   - Node version: `20`（リポジトリ要件 >= 20.9。必要なら環境変数
     `NODE_VERSION=20` を Pages 側に設定）
   - 環境変数: 不要（`NEXT_PUBLIC_SYNC_URL` は `next.config.ts` に baked-in）
4. 保存後、`main` への push/マージで自動的に本番デプロイされる。
   PR ブランチには自動でプレビュー URL が付く。

> 注: GitHub 連携を有効化すると、以後は Git 連携が本番デプロイの主経路。
> CLI 直デプロイ（上記「手動デプロイ」）も併用可能だが、Git 連携と
> 混在させると最新がどちらか分かりにくくなるため、連携後は原則 Git 経由に統一する。

## オフライン PWA との関係

`sw.js` は `public/_headers` で `no-cache, no-store` 配信のため常に最新を取得。
アプリシェル（HTML/JS/CSS/フォント/アイコン）は SW がランタイムキャッシュし、
データは元々 localStorage。HTTPS 配信（pages.dev）で iPhone のホーム画面追加・
完全オフライン・同期コードによる端末間同期がすべて有効になる。
