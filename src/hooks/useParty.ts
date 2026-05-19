"use client";

import { useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { randomId } from "@/lib/uuid";
import {
  Party,
  PartyMember,
  PARTY_MAX_MEMBERS,
  PARTY_MAX_MOVES,
  emptyParty,
} from "@/types/party";
import { movesForSpecies } from "@/lib/moves";

const STORAGE_KEY = "pokelog-bdsp-party-v1";

/**
 * 旧 localStorage / 旧同期スナップショットの member は moves を持たない。
 * sync.ts の applySnapshot は raw JSON を localStorage に書くだけなので、
 * この読み取り時正規化が旧ローカルと旧リモートの両方を吸収する。
 * （だから sync.ts の SNAPSHOT_SCHEMA を bump する必要はない＝加算的変更。）
 */
function normalizeMoves(moves: unknown): string[] {
  const arr = Array.isArray(moves) ? moves : [];
  const out = arr
    .slice(0, PARTY_MAX_MOVES)
    .map((m) => (typeof m === "string" ? m : ""));
  while (out.length < PARTY_MAX_MOVES) out.push("");
  return out;
}

function normalizeParty(p: Party): Party {
  return {
    ...p,
    members: p.members.map((m) => ({ ...m, moves: normalizeMoves(m.moves) })),
  };
}

export function useParty() {
  const [rawParty, setParty, hydrated] = useLocalStorage<Party>(
    STORAGE_KEY,
    emptyParty()
  );

  const party = useMemo(() => normalizeParty(rawParty), [rawParty]);

  const updateParty = (data: Partial<Pick<Party, "name" | "version">>) => {
    setParty((prev) => ({ ...prev, ...data }));
  };

  const addMember = (data: Omit<PartyMember, "id">) => {
    setParty((prev) => {
      if (prev.members.length >= PARTY_MAX_MEMBERS) return prev;
      const member: PartyMember = {
        ...data,
        moves: normalizeMoves(data.moves),
        id: randomId(),
      };
      return { ...prev, members: [...prev.members, member] };
    });
  };

  const updateMember = (
    memberId: string,
    data: Partial<Omit<PartyMember, "id">>
  ) => {
    setParty((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id !== memberId) return m;
        const merged = { ...m, ...data };
        // 種族がカードで変更されたら、新種族で取れない技を落とす
        // （モーダルの onSpeciesChange と同じ規則をここに集約）。
        if (
          data.speciesId !== undefined &&
          data.speciesId !== m.speciesId
        ) {
          const valid = movesForSpecies(merged.speciesId);
          if (valid.length > 0) {
            merged.moves = normalizeMoves(merged.moves).map((mv) =>
              mv === "" || valid.includes(mv) ? mv : ""
            );
          }
        }
        return merged;
      }),
    }));
  };

  const removeMember = (memberId: string) => {
    setParty((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== memberId),
    }));
  };

  const resetParty = () => setParty(emptyParty());

  return {
    party,
    hydrated,
    updateParty,
    addMember,
    updateMember,
    removeMember,
    resetParty,
  };
}
