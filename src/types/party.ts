export const GAME_VERSIONS = ["bd", "sp"] as const;
export type GameVersion = (typeof GAME_VERSIONS)[number];

export const GAME_VERSION_LABELS: Record<GameVersion, string> = {
  bd: "ブリリアントダイヤモンド",
  sp: "シャイニングパール",
};

export const NATURES = [
  "がんばりや", "さみしがり", "ゆうかん", "いじっぱり", "やんちゃ",
  "ずぶとい", "すなお", "のんき", "わんぱく", "のうてんき",
  "おくびょう", "せっかち", "まじめ", "ようき", "むじゃき",
  "ひかえめ", "おっとり", "れいせい", "てれや", "うっかりや",
  "おだやか", "おとなしい", "なまいき", "しんちょう", "きまぐれ",
] as const;
export type Nature = (typeof NATURES)[number];

export const PARTY_MAX_MOVES = 4;

/** 技スロットの空配列（長さ4）。モーダル既定値とフック正規化で共有する唯一の真実源。 */
export function emptyMoves(): string[] {
  return ["", "", "", ""];
}

export interface PartyMember {
  id: string;
  speciesId: number;
  speciesName: string;
  nickname: string;
  level: number;
  nature: string;
  ability: string;
  heldItem: string;
  /** 覚えている技（最大4）。ability/nature/heldItem と同じく日本語文字列。空スロットは ""。 */
  moves: string[];
  notes: string;
}

export interface Party {
  name: string;
  version: GameVersion;
  members: PartyMember[];
}

export function emptyParty(): Party {
  return { name: "", version: "bd", members: [] };
}

export const PARTY_MAX_MEMBERS = 6;
