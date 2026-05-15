import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom in this environment ships a non-functional localStorage stub
// (setItem/clear are not callable). Provide a real in-memory implementation
// so the hooks under test can persist/rehydrate state.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

function installMemoryStorage() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
  }
}

installMemoryStorage();

afterEach(() => {
  cleanup();
  installMemoryStorage();
});

if (!globalThis.crypto) {
  (globalThis as any).crypto = require("node:crypto").webcrypto;
}
if (typeof globalThis.crypto.randomUUID !== "function") {
  (globalThis.crypto as any).randomUUID = () =>
    "00000000-0000-4000-8000-000000000000";
}

vi.mock("next/font/local", () => ({
  default: () => ({ className: "mock-font", variable: "--mock-font" }),
}));
