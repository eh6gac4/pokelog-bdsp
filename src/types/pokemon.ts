export const EV_STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export type EvStat = (typeof EV_STATS)[number];

export const EV_STAT_LABELS: Record<EvStat, string> = {
  hp: "HP",
  atk: "こうげき",
  def: "ぼうぎょ",
  spa: "とくこう",
  spd: "とくぼう",
  spe: "すばやさ",
};

export type EvSpread = Record<EvStat, number>;

export interface PokemonEntry {
  id: string;
  speciesId: number;
  speciesName: string;
  nickname: string;
  level: number;
  evs: EvSpread;
  nature: string;
  caughtAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function emptyEvSpread(): EvSpread {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function totalEvs(evs: EvSpread): number {
  return Object.values(evs).reduce((a, b) => a + b, 0);
}
