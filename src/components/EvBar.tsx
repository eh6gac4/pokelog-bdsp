"use client";

import { EV_STATS, EV_STAT_LABELS, EvSpread, totalEvs } from "@/types/pokemon";

const MAX_TOTAL = 510;
const MAX_SINGLE = 252;

const STAT_COLORS: Record<string, string> = {
  hp: "bg-red-400",
  atk: "bg-orange-400",
  def: "bg-yellow-400",
  spa: "bg-blue-400",
  spd: "bg-green-400",
  spe: "bg-pink-400",
};

interface Props {
  evs: EvSpread;
  onChange?: (stat: string, value: number) => void;
  readonly?: boolean;
}

export function EvBar({ evs, onChange, readonly = false }: Props) {
  const total = totalEvs(evs);

  return (
    <div className="space-y-2">
      {EV_STATS.map((stat) => (
        <div key={stat} className="flex items-center gap-2 text-sm">
          <span className="w-14 shrink-0 text-right text-gray-500">
            {EV_STAT_LABELS[stat]}
          </span>
          <div className="relative flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
            <div
              className={`h-full ${STAT_COLORS[stat]} transition-all`}
              style={{ width: `${(evs[stat] / MAX_SINGLE) * 100}%` }}
            />
          </div>
          {readonly ? (
            <span className="w-10 text-right tabular-nums">{evs[stat]}</span>
          ) : (
            <input
              type="number"
              min={0}
              max={MAX_SINGLE}
              value={evs[stat]}
              onChange={(e) => onChange?.(stat, Number(e.target.value))}
              className="w-14 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-1 py-0.5 text-right tabular-nums text-sm"
            />
          )}
        </div>
      ))}
      <div className="flex justify-end text-xs text-gray-400">
        合計 {total} / {MAX_TOTAL}
        {total > MAX_TOTAL && (
          <span className="ml-1 text-red-500 font-medium">超過!</span>
        )}
      </div>
    </div>
  );
}
