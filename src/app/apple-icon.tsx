import { ImageResponse } from "next/og";

// iOS ホーム画面アイコン（apple-touch-icon を自動生成）。
// iOS は角丸/光沢を自前処理するため背景は不透明・正方形フルブリード。
// public/icon.svg と同じスーパーボール(Great Ball)のドット絵を再現する。
// output:"export" でビルド時に静的 PNG として書き出す。
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// public/icon.svg と同一のピクセルマップ。
// '.' 透明 / K 黒枠・帯 / B 青(上半分) / R 赤マーク / W 白(下半分・ボタン)
const MAP = [
  "......KKKK......",
  "....KBBBBBBK....",
  "...KRBBBBBBRK...",
  "..KBRRBBBBRRBK..",
  "..KBBRRBBRRBBK..",
  ".KBBBBRRRRBBBBK.",
  ".KBBBBBRRBBBBBK.",
  "KKKKKKWWWWKKKKKK",
  "KKKKKKWWWWKKKKKK",
  ".KWWWWWWWWWWWWK.",
  ".KWWWWWWWWWWWWK.",
  "..KWWWWWWWWWWK..",
  "..KWWWWWWWWWWK..",
  "...KWWWWWWWWK...",
  "....KWWWWWWK....",
  "......KKKK......",
];
const COLORS: Record<string, string> = {
  K: "#0a0a0a",
  B: "#3460c4",
  R: "#e3350d",
  W: "#f5f5f5",
};

export default function AppleIcon() {
  const N = 16;
  const cell = 9; // 16*9 = 144（180 の枠内に余白を残す）
  const offset = (size.width - N * cell) / 2; // = 18

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const color = COLORS[MAP[y][x]];
      if (!color) continue;
      cells.push(
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: offset + x * cell,
            top: offset + y * cell,
            width: cell,
            height: cell,
            background: color,
          }}
        />,
      );
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0a0a0a",
        }}
      >
        {cells}
      </div>
    ),
    { ...size },
  );
}
