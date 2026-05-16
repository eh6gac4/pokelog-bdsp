import type { MetadataRoute } from "next";

// output:"export" でビルド時に静的 manifest.webmanifest として書き出す。
export const dynamic = "force-static";

// Web App Manifest（App Router のファイル規約）。
// Next が自動で <link rel="manifest" href="/manifest.webmanifest"> を注入する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ポケログBDSP",
    short_name: "ポケログBDSP",
    description: "BDSP のプレイ記録（旅パ・努力値ログ）ツール",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // globals.css のダーク --background に合わせる
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
