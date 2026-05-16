/**
 * セキュアコンテキスト(HTTPS / localhost)以外でも動く UUID v4 生成。
 *
 * `crypto.randomUUID()` は secure context 限定のため、LAN IP の平文 HTTP
 * (例 http://192.168.1.253:3000)で開くと undefined になり落ちる。
 * `crypto.getRandomValues()` は非セキュアでも利用できるのでそれで v4 を組み立て、
 * どちらも無い極限ケースのみ Math.random にフォールバックする。
 */
export function randomId(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }

  // 最終フォールバック(暗号学的強度はない)。
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
