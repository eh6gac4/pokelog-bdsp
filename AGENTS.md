<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 開発サーバの運用ルール

`npm run dev` の dev サーバは**必要な時だけ起動し、用が済んだら停止する**。常駐させない。

理由:
- Next.js はプロジェクトごとに dev サーバのシングルインスタンスロックがあり、起動しっぱなしだと `npm run e2e`（Playwright の webServer）が「Another next dev server is already running」で失敗する。
- 常駐ブラウザ/サーバはマシン負荷になる。

運用:
- E2E は `npm run e2e` が webServer 設定で自前に dev サーバを起動・停止するので、手動で dev サーバを立てておく必要はない（むしろ立てない）。
- 動作確認等で手動起動した場合は、確認が終わったらそのプロセスを停止する。
- サブエージェント等で検証起動した dev サーバも、検証後に必ず停止する（停止漏れが過去に E2E をブロックした）。
