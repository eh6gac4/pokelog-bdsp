"use client";

import { useState } from "react";
import { SpeciesNameInput } from "@/components/SpeciesNameInput";
import { AbilitySelect } from "@/components/party/AbilitySelect";
import { NATURES, PartyMember } from "@/types/party";
import { PokemonEntry } from "@/types/pokemon";
import { FIELD_CLASS } from "@/lib/fieldClass";
import { abilitiesForSpecies } from "@/lib/speciesAbilities";

type FormData = Omit<PartyMember, "id">;
type Tab = "log" | "new";

interface Props {
  logEntries: PokemonEntry[];
  abilitySuggestions: string[];
  heldItemSuggestions: string[];
  onAdd: (data: FormData) => void;
  onClose: () => void;
}

const emptyForm = (): FormData => ({
  speciesId: 0,
  speciesName: "",
  nickname: "",
  level: 1,
  nature: "",
  ability: "",
  heldItem: "",
  notes: "",
});

export function AddPartyMemberModal({
  logEntries,
  abilitySuggestions,
  heldItemSuggestions,
  onAdd,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("new");
  const [form, setForm] = useState<FormData>(emptyForm());
  const [pickedLogId, setPickedLogId] = useState<string | null>(null);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSpeciesChange = (name: string, id: number | undefined) =>
    setForm((prev) => {
      const nextId = id !== undefined ? id : prev.speciesId;
      const validAbilities = abilitiesForSpecies(nextId);
      // 種族が変わって今の特性がその種族で取れないなら未設定に戻す。
      const abilityStillValid =
        prev.ability === "" ||
        validAbilities.length === 0 ||
        validAbilities.includes(prev.ability);
      return {
        ...prev,
        speciesName: name,
        speciesId: nextId,
        ability: abilityStillValid ? prev.ability : "",
      };
    });

  const pickFromLog = (entry: PokemonEntry) => {
    setPickedLogId(entry.id);
    setForm({
      speciesId: entry.speciesId,
      speciesName: entry.speciesName,
      nickname: entry.nickname,
      level: entry.level,
      nature: entry.nature,
      ability: "",
      heldItem: "",
      notes: entry.notes,
    });
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setPickedLogId(null);
    setForm(emptyForm());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.speciesName.trim()) return;
    onAdd(form);
    onClose();
  };

  const showForm = tab === "new" || pickedLogId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">メンバーを追加</h2>

        <div className="flex gap-1 mb-4 rounded-lg bg-gray-100 dark:bg-gray-700 p-1 text-sm">
          <button
            type="button"
            onClick={() => switchTab("new")}
            className={`flex-1 rounded py-2 transition-colors ${
              tab === "new"
                ? "bg-white dark:bg-gray-600 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            新規入力
          </button>
          <button
            type="button"
            onClick={() => switchTab("log")}
            className={`flex-1 rounded py-2 transition-colors ${
              tab === "log"
                ? "bg-white dark:bg-gray-600 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            努力値ログから
          </button>
        </div>

        {tab === "log" && (
          <div className="mb-4">
            {logEntries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                努力値ログにポケモンがいません
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {logEntries.map((entry) => {
                  const label = entry.nickname
                    ? `${entry.nickname}（${entry.speciesName || "?"}）`
                    : entry.speciesName || "不明";
                  const picked = pickedLogId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => pickFromLog(entry)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        picked
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30"
                          : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="text-gray-400 font-mono text-xs w-8">
                        #{String(entry.speciesId || "?").padStart(3, "0")}
                      </span>
                      <span className="flex-1">{label}</span>
                      <span className="text-xs text-gray-400">
                        Lv.{entry.level}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {pickedLogId !== null && (
              <p className="text-xs text-gray-500 mt-3">
                とくせい・もちものを入力して「追加」を押してください
              </p>
            )}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-gray-500">種族名 *</span>
                <SpeciesNameInput
                  value={form.speciesName}
                  onChange={onSpeciesChange}
                  required
                  listId="party-species-list"
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
                <select
                  className={FIELD_CLASS}
                  value={form.nature}
                  onChange={(e) => set("nature", e.target.value)}
                >
                  <option value="">未設定</option>
                  {NATURES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-500">とくせい</span>
                <AbilitySelect
                  speciesId={form.speciesId}
                  value={form.ability}
                  onChange={(a) => set("ability", a)}
                  fallbackListId="modal-ability-list"
                  fallbackSuggestions={abilitySuggestions}
                />
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-gray-500">もちもの</span>
                <input
                  list="modal-held-item-list"
                  className={FIELD_CLASS}
                  value={form.heldItem}
                  onChange={(e) => set("heldItem", e.target.value)}
                  placeholder="きあいのタスキ"
                />
                <datalist id="modal-held-item-list">
                  {heldItemSuggestions.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-gray-500">メモ</span>
                <textarea
                  rows={2}
                  className={`${FIELD_CLASS} resize-none`}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="そだてやに預けた / ともだちにもらった など"
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
        )}

        {!showForm && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
