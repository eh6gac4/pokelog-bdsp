import { describe, it, expect } from "vitest";
import { sha256Bytes, toHex, base64url } from "./sha256";

const sha = (s: string) => toHex(sha256Bytes(s));

describe("sha256 known-answer vectors", () => {
  it('"" → e3b0c442...', () => {
    expect(sha("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
  it('"abc" → ba7816bf...', () => {
    expect(sha("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("56byte 入力（ブロック境界）", () => {
    expect(
      sha("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    ).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });
  it("マルチバイト(UTF-8)も決定的", () => {
    // 同じ入力は常に同じ（端末間同期の根拠）。
    expect(sha("ポケログ合言葉")).toBe(sha("ポケログ合言葉"));
    expect(sha("ポケログ合言葉")).not.toBe(sha("ポケログ合言葉 "));
  });
});

describe("base64url", () => {
  it("32 バイトは 43 文字・URL 安全・パディング無し", () => {
    const k = base64url(sha256Bytes("any-passphrase"));
    expect(k).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]+$/.test(k)).toBe(true);
    expect(k.includes("=")).toBe(false);
  });
  it("既知ベクタ: sha256('') の base64url", () => {
    expect(base64url(sha256Bytes(""))).toBe(
      "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
    );
  });
});
