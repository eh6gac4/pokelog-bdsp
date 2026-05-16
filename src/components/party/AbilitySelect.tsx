"use client";

import { abilitiesForSpecies } from "@/lib/speciesAbilities";
import { FIELD_CLASS } from "@/lib/fieldClass";

interface Props {
  /** 全国図鑑 No.（PartyMember.speciesId）。0 や未知の種族はフォールバック入力。 */
  speciesId: number;
  value: string;
  onChange: (ability: string) => void;
  /** 種族データが無いときに使う datalist の id。 */
  fallbackListId: string;
  /** 種族データが無いときの候補（既存メンバーの特性など）。 */
  fallbackSuggestions: string[];
}

/**
 * 種族に合わせて特性を選ぶ。種族のデータがあれば <select>、
 * 無ければ datalist 付きの自由入力にフォールバックする。
 */
export function AbilitySelect({
  speciesId,
  value,
  onChange,
  fallbackListId,
  fallbackSuggestions,
}: Props) {
  const abilities = abilitiesForSpecies(speciesId);

  if (abilities.length === 0) {
    return (
      <>
        <input
          list={fallbackListId}
          className={FIELD_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="げきりゅう"
        />
        <datalist id={fallbackListId}>
          {fallbackSuggestions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </>
    );
  }

  // 既存値が候補に無い場合（ログ取り込み・種族変更・古いデータ）でも
  // 値を失わないよう、先頭に残して選べるようにする。
  const options =
    value && !abilities.includes(value) ? [value, ...abilities] : abilities;

  return (
    <select
      className={FIELD_CLASS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">未設定</option>
      {options.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}
