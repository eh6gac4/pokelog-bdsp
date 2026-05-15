"use client";

import { useState } from "react";
import { PokemonEntry } from "@/types/pokemon";
import { EvBar } from "./EvBar";

interface Props {
  entry: PokemonEntry;
  onUpdate: (id: string, data: Partial<PokemonEntry>) => void;
  onRemove: (id: string) => void;
}

export function PokemonCard({ entry, onUpdate, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);

  const displayName = entry.nickname
    ? `${entry.nickname}（${entry.speciesName}）`
    : entry.speciesName || "不明";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-gray-400 font-mono text-xs w-8">
          #{String(entry.speciesId || "?").padStart(3, "0")}
        </span>
        <span className="flex-1 font-medium">{displayName}</span>
        <span className="text-sm text-gray-400">Lv.{entry.level}</span>
        <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">種族名</span>
              <input
                className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1"
                value={entry.speciesName}
                onChange={(e) => onUpdate(entry.id, { speciesName: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">ニックネーム</span>
              <input
                className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1"
                value={entry.nickname}
                onChange={(e) => onUpdate(entry.id, { nickname: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">レベル</span>
              <input
                type="number"
                min={1}
                max={100}
                className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1"
                value={entry.level}
                onChange={(e) => onUpdate(entry.id, { level: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">せいかく</span>
              <input
                className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1"
                value={entry.nature}
                onChange={(e) => onUpdate(entry.id, { nature: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-gray-500">捕まえた場所</span>
              <input
                className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1"
                value={entry.caughtAt}
                onChange={(e) => onUpdate(entry.id, { caughtAt: e.target.value })}
              />
            </label>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">努力値 (EV)</p>
            <EvBar
              evs={entry.evs}
              onChange={(stat, value) =>
                onUpdate(entry.id, { evs: { ...entry.evs, [stat]: value } })
              }
            />
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">メモ</span>
            <textarea
              rows={2}
              className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1 resize-none"
              value={entry.notes}
              onChange={(e) => onUpdate(entry.id, { notes: e.target.value })}
            />
          </label>

          <div className="flex justify-end">
            <button
              onClick={() => onRemove(entry.id)}
              className="text-sm text-red-400 hover:text-red-600"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
