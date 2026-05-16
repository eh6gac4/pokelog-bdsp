import { ImageResponse } from "next/og";

// iOS ホーム画面アイコン（apple-touch-icon を自動生成）。
// iOS は角丸/光沢を自前処理するため背景は不透明・正方形フルブリード。
// output:"export" でビルド時に静的 PNG として書き出す。
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const D = 132; // Poké Ball 直径（180 の枠内に余白を残す）
  const band = 14;
  const btn = 46;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            position: "relative",
            width: D,
            height: D,
            borderRadius: D,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ width: D, height: D / 2, background: "#e3350d" }} />
          <div style={{ width: D, height: D / 2, background: "#f5f5f5" }} />
          <div
            style={{
              position: "absolute",
              top: D / 2 - band / 2,
              left: 0,
              width: D,
              height: band,
              background: "#0a0a0a",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: (D - btn) / 2,
              left: (D - btn) / 2,
              width: btn,
              height: btn,
              borderRadius: btn,
              background: "#f5f5f5",
              border: "8px solid #0a0a0a",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
