"use client";

import { useLocalStorage } from "./useLocalStorage";
import { randomId } from "@/lib/uuid";
import {
  Party,
  PartyMember,
  PARTY_MAX_MEMBERS,
  emptyParty,
} from "@/types/party";

const STORAGE_KEY = "pokelog-bdsp-party-v1";

export function useParty() {
  const [party, setParty, hydrated] = useLocalStorage<Party>(
    STORAGE_KEY,
    emptyParty()
  );

  const updateParty = (data: Partial<Pick<Party, "name" | "version">>) => {
    setParty((prev) => ({ ...prev, ...data }));
  };

  const addMember = (data: Omit<PartyMember, "id">) => {
    setParty((prev) => {
      if (prev.members.length >= PARTY_MAX_MEMBERS) return prev;
      const member: PartyMember = { ...data, id: randomId() };
      return { ...prev, members: [...prev.members, member] };
    });
  };

  const updateMember = (
    memberId: string,
    data: Partial<Omit<PartyMember, "id">>
  ) => {
    setParty((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === memberId ? { ...m, ...data } : m
      ),
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
