"use client";

import { useState } from "react";
import { NATURES, PartyMember } from "@/types/party";
import { AbilitySelect } from "@/components/party/AbilitySelect";
import { FIELD_CLASS } from "@/lib/fieldClass";

interface Props {
  member: PartyMember;
  abilitySuggestions: string[];
  heldItemSuggestions: string[];
  onUpdate: (id: string, data: Partial<Omit<PartyMember, "id">>) => void;
  onRemove: (id: string) => void;
}

export function PartyMemberCard({
  member,
  abilitySuggestions,
  heldItemSuggestions,
  onUpdate,
  onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const displayName = member.nickname
    ? `${member.nickname}（${member.speciesName}）`
    : member.speciesName || "不明";

  const abilityListId = `ability-list-${member.id}`;
  const heldItemListId = `held-item-list-${member.id}`;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-gray-400 font-mono text-xs w-8">
          #{String(member.speciesId || "?").padStart(3, "0")}
        </span>
        <span className="flex-1 font-medium">{displayName}</span>
        <span className="text-sm text-gray-400">Lv.{member.level}</span>
        <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">種族名</span>
              <input
                className={FIELD_CLASS}
                value={member.speciesName}
                onChange={(e) =>
                  onUpdate(member.id, { speciesName: e.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">ニックネーム</span>
              <input
                className={FIELD_CLASS}
                value={member.nickname}
                onChange={(e) =>
                  onUpdate(member.id, { nickname: e.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">図鑑番号</span>
              <input
                type="number"
                min={0}
                className={FIELD_CLASS}
                value={member.speciesId || ""}
                onChange={(e) =>
                  onUpdate(member.id, { speciesId: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">レベル</span>
              <input
                type="number"
                min={1}
                max={100}
                className={FIELD_CLASS}
                value={member.level}
                onChange={(e) =>
                  onUpdate(member.id, { level: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500">せいかく</span>
              <select
                className={FIELD_CLASS}
                value={member.nature}
                onChange={(e) =>
                  onUpdate(member.id, { nature: e.target.value })
                }
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
                speciesId={member.speciesId}
                value={member.ability}
                onChange={(a) => onUpdate(member.id, { ability: a })}
                fallbackListId={abilityListId}
                fallbackSuggestions={abilitySuggestions}
              />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-gray-500">もちもの</span>
              <input
                list={heldItemListId}
                className={FIELD_CLASS}
                value={member.heldItem}
                onChange={(e) =>
                  onUpdate(member.id, { heldItem: e.target.value })
                }
              />
              <datalist id={heldItemListId}>
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
                value={member.notes ?? ""}
                onChange={(e) =>
                  onUpdate(member.id, { notes: e.target.value })
                }
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => onRemove(member.id)}
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
