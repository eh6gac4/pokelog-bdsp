"use client";

import { useState } from "react";
import { SpeciesNameInput } from "@/components/SpeciesNameInput";
import { FIELD_CLASS } from "@/lib/fieldClass";
import { PokemonEntry, emptyEvSpread } from "@/types/pokemon";

type FormData = Omit<PokemonEntry, "id" | "createdAt" | "updatedAt">;

interface Props {
  onAdd: (data: FormData) => void;
  onClose: () => void;
}

export function AddPokemonModal({ onAdd, onClose }: Props) {
  const [form, setForm] = useState<FormData>({
    speciesId: 0,
    speciesName: "",
    nickname: "",
    level: 1,
    evs: emptyEvSpread(),
    nature: "",
    caughtAt: "",
    notes: "",
  });

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSpeciesChange = (name: string, id: number | undefined) =>
    setForm((prev) => ({
      ...prev,
      speciesName: name,
      speciesId: id !== undefined ? id : prev.speciesId,
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.speciesName.trim()) return;
    onAdd(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">ポケモンを追加</h2>
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">種族名 *</span>
              <SpeciesNameInput
                value={form.speciesName}
                onChange={onSpeciesChange}
                required
                listId="ev-species-list"
                className={FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">ニックネーム</span>
              <input
                className={FIELD_CLASS}
                value={form.nickname}
                onChange={(e) => set("nickname", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">図鑑番号</span>
              <input
                type="number"
                min={0}
                className={FIELD_CLASS}
                value={form.speciesId || ""}
                onChange={(e) => set("speciesId", Number(e.target.value))}
                placeholder="393"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">レベル</span>
              <input
                type="number"
                min={1}
                max={100}
                className={FIELD_CLASS}
                value={form.level}
                onChange={(e) => set("level", Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">せいかく</span>
              <input
                className={FIELD_CLASS}
                value={form.nature}
                onChange={(e) => set("nature", e.target.value)}
                placeholder="ひかえめ"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">捕まえた場所</span>
              <input
                className={FIELD_CLASS}
                value={form.caughtAt}
                onChange={(e) => set("caughtAt", e.target.value)}
                placeholder="マサゴタウン"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-500 px-4 py-2 text-white font-medium hover:bg-blue-600"
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
