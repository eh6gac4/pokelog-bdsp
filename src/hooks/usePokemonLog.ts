"use client";

import { useLocalStorage } from "./useLocalStorage";
import { PokemonEntry, emptyEvSpread } from "@/types/pokemon";

const STORAGE_KEY = "pokelog-bdsp-v1";

export function usePokemonLog() {
  const [entries, setEntries, hydrated] = useLocalStorage<PokemonEntry[]>(
    STORAGE_KEY,
    []
  );

  const add = (
    data: Omit<PokemonEntry, "id" | "createdAt" | "updatedAt">
  ): PokemonEntry => {
    const now = new Date().toISOString();
    const entry: PokemonEntry = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setEntries((prev) => [...prev, entry]);
    return entry;
  };

  const update = (id: string, data: Partial<Omit<PokemonEntry, "id" | "createdAt">>) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
      )
    );
  };

  const remove = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const newEntryDefaults = (): Omit<PokemonEntry, "id" | "createdAt" | "updatedAt"> => ({
    speciesId: 0,
    speciesName: "",
    nickname: "",
    level: 1,
    evs: emptyEvSpread(),
    nature: "",
    caughtAt: "",
    notes: "",
  });

  return { entries, add, update, remove, newEntryDefaults, hydrated };
}
