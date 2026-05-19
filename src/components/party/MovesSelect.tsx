"use client";

import {
  classifiedMovesForSpecies,
  type ClassifiedLearnset,
} from "@/lib/moves";
import { PARTY_MAX_MOVES } from "@/types/party";
import { FIELD_CLASS } from "@/lib/fieldClass";

interface Props {
  /** 全国図鑑 No.（PartyMember.speciesId）。0 や未知の種族はフォールバック入力。 */
  speciesId: number;
  /** 技スロット（長さは問わない。内部で PARTY_MAX_MOVES 長に正規化して扱う）。 */
  value: string[];
  onChange: (moves: string[]) => void;
  /** 種族データが無いときに使う datalist の id ベース。スロット毎に `-{i}` を付与。 */
  fallbackListId: string;
  /** 種族データが無いときの候補。 */
  fallbackSuggestions: string[];
}

function padded(value: string[]): string[] {
  const out = value.slice(0, PARTY_MAX_MOVES);
  while (out.length < PARTY_MAX_MOVES) out.push("");
  return out;
}

type Group = { key: string; label: string; options: { name: string; label: string }[] };

/** 学習方法ごとに optgroup を構築。複数方法で覚える技は各グループに重複表示（仕様）。 */
function buildGroups(cls: ClassifiedLearnset): Group[] {
  const groups: Group[] = [
    {
      key: "levelUp",
      label: "レベルアップ",
      options: cls.levelUp.map((m) => ({
        name: m.name,
        label: `${m.level === 0 ? "Lv.—" : `Lv.${m.level}`} ${m.name}`,
      })),
    },
    {
      key: "machine",
      label: "わざマシン",
      options: cls.machine.map((n) => ({ name: n, label: n })),
    },
    { key: "egg", label: "タマゴ", options: cls.egg.map((n) => ({ name: n, label: n })) },
    {
      key: "tutor",
      label: "教え技",
      options: cls.tutor.map((n) => ({ name: n, label: n })),
    },
    {
      key: "other",
      label: "その他",
      options: cls.other.map((n) => ({ name: n, label: n })),
    },
  ];
  return groups.filter((g) => g.options.length > 0);
}

/**
 * 種族に合わせて技を 4 つ選ぶ。種族のデータがあれば学習方法別 optgroup の
 * <select>、無ければ datalist 付きの自由入力にフォールバックする。
 * add/edit 固有のロジックは持たない純粋 controlled input なので、
 * 追加モーダルと登録済みカードの両方で再利用できる。
 */
export function MovesSelect({
  speciesId,
  value,
  onChange,
  fallbackListId,
  fallbackSuggestions,
}: Props) {
  const slots = padded(value);
  const cls = classifiedMovesForSpecies(speciesId);
  const hasData = cls !== null;
  const allGroups = cls ? buildGroups(cls) : [];
  const allNames = new Set(
    allGroups.flatMap((g) => g.options.map((o) => o.name)),
  );

  const setSlot = (i: number, move: string) => {
    const next = slots.slice();
    next[i] = move;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((current, i) => {
        if (!hasData) {
          const listId = `${fallbackListId}-${i}`;
          return (
            <div key={i}>
              <input
                list={listId}
                className={`${FIELD_CLASS} w-full`}
                value={current}
                onChange={(e) => setSlot(i, e.target.value)}
                placeholder={`わざ${i + 1}`}
                aria-label={`わざ${i + 1}`}
              />
              <datalist id={listId}>
                {fallbackSuggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          );
        }

        // 他スロットで選択済みの技は候補から除外（自スロット現値は残す）。
        const takenElsewhere = new Set(
          slots.filter((_, j) => j !== i).filter(Boolean),
        );

        return (
          <select
            key={i}
            className={`${FIELD_CLASS} w-full`}
            value={current}
            onChange={(e) => setSlot(i, e.target.value)}
            aria-label={`わざ${i + 1}`}
          >
            <option value="">未設定</option>
            {/* 現値が候補に無い（ログ取込・種族変更・旧データ）場合も失わない。 */}
            {current && !allNames.has(current) && (
              <option value={current}>{current}</option>
            )}
            {allGroups.map((g) => {
              const opts = g.options.filter(
                (o) => o.name === current || !takenElsewhere.has(o.name),
              );
              if (opts.length === 0) return null;
              return (
                <optgroup key={g.key} label={g.label}>
                  {opts.map((o) => (
                    <option key={`${g.key}-${o.name}`} value={o.name}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        );
      })}
    </div>
  );
}
