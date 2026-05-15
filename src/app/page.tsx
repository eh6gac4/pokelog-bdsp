"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParty } from "@/hooks/useParty";
import { usePokemonLog } from "@/hooks/usePokemonLog";
import {
  GAME_VERSIONS,
  GAME_VERSION_LABELS,
  GameVersion,
  PARTY_MAX_MEMBERS,
} from "@/types/party";
import { PartyMemberCard } from "@/components/party/PartyMemberCard";
import { AddPartyMemberModal } from "@/components/party/AddPartyMemberModal";

export default function PartyPage() {
  const {
    party,
    hydrated,
    updateParty,
    addMember,
    updateMember,
    removeMember,
    resetParty,
  } = useParty();
  const { entries: logEntries, hydrated: logHydrated } = usePokemonLog();
  const [showModal, setShowModal] = useState(false);

  const abilitySuggestions = useMemo(
    () =>
      Array.from(
        new Set(party.members.map((m) => m.ability).filter(Boolean))
      ),
    [party.members]
  );
  const heldItemSuggestions = useMemo(
    () =>
      Array.from(
        new Set(party.members.map((m) => m.heldItem).filter(Boolean))
      ),
    [party.members]
  );

  if (!hydrated || !logHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 dark:text-gray-500">
        読み込み中...
      </div>
    );
  }

  const handleReset = () => {
    if (party.members.length === 0 && !party.name) {
      resetParty();
      return;
    }
    if (window.confirm("旅パをリセットしますか？")) {
      resetParty();
    }
  };

  const canAdd = party.members.length < PARTY_MAX_MEMBERS;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <header className="mb-6">
        <Link
          href="/ev"
          className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          ← 努力値ログ
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">旅パ</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {party.members.length} / {PARTY_MAX_MEMBERS} 体
            </p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            リセット
          </button>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-500">パーティ名</span>
          <input
            className="rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1"
            value={party.name}
            onChange={(e) => updateParty({ name: e.target.value })}
            placeholder="旅パ名"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-500">バージョン</span>
          <select
            className="rounded border border-gray-200 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-100"
            value={party.version}
            onChange={(e) =>
              updateParty({ version: e.target.value as GameVersion })
            }
          >
            {GAME_VERSIONS.map((v) => (
              <option key={v} value={v}>
                {GAME_VERSION_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
      </section>

      {party.members.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-12 text-center text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">🎒</p>
          <p className="font-medium">メンバー未登録</p>
          <p className="text-sm mt-1">下の「+ メンバー追加」から登録</p>
        </div>
      ) : (
        <div className="space-y-3">
          {party.members.map((member) => (
            <PartyMemberCard
              key={member.id}
              member={member}
              abilitySuggestions={abilitySuggestions}
              heldItemSuggestions={heldItemSuggestions}
              onUpdate={updateMember}
              onRemove={removeMember}
            />
          ))}
        </div>
      )}

      {canAdd && (
        <button
          onClick={() => setShowModal(true)}
          className="mt-4 w-full rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-3 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          + メンバー追加
        </button>
      )}

      {showModal && (
        <AddPartyMemberModal
          logEntries={logEntries}
          abilitySuggestions={abilitySuggestions}
          heldItemSuggestions={heldItemSuggestions}
          onAdd={addMember}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
