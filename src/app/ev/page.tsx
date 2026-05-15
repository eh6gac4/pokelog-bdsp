"use client";

import Link from "next/link";
import { useState } from "react";
import { usePokemonLog } from "@/hooks/usePokemonLog";
import { PokemonCard } from "@/components/PokemonCard";
import { AddPokemonModal } from "@/components/AddPokemonModal";

export default function EvLogPage() {
  const { entries, add, update, remove, hydrated } = usePokemonLog();
  const [showModal, setShowModal] = useState(false);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 dark:text-gray-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">pokelog-bdsp</h1>
          <p className="text-xs text-gray-400 mt-0.5">{entries.length} 匹登録中</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-blue-500"
          >
            旅パ →
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            + 追加
          </button>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-16 text-center text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">🎮</p>
          <p className="font-medium">まだ登録がありません</p>
          <p className="text-sm mt-1">「+ 追加」からポケモンを登録しましょう</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <PokemonCard
              key={entry.id}
              entry={entry}
              onUpdate={update}
              onRemove={remove}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddPokemonModal onAdd={add} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
