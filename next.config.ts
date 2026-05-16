import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 全ルートがクライアント側のみ（サーバコード皆無）なので静的書き出し。
  // Cloudflare Pages に out/ をそのまま配信する。
  output: "export",
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ["192.168.1.253"],
  // 同期 Worker URL（秘密ではない。認証は同期コード）。.env* は gitignore
  // のためここで baked-in しどの環境でも有効化する。
  env: {
    NEXT_PUBLIC_SYNC_URL:
      "https://pokelog-bdsp-sync.toshiki-cho-dev.workers.dev",
  },
  // 注: `output: "export"` では next.config の headers() は無効。
  // セキュリティ／sw.js のヘッダは public/_headers（Cloudflare Pages）で付与。
};

export default nextConfig;
