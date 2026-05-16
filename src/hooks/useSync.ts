"use client";

import { useCallback, useState } from "react";
import {
  connectWithCode,
  disconnectSync,
  generateSyncCode,
  getSyncCode,
  isValidSyncCode,
  runSync,
  syncConfigured,
  type SyncStatus,
} from "@/lib/sync";

export interface UseSync {
  configured: boolean;
  code: string | null;
  busy: boolean;
  lastStatus: SyncStatus | null;
  /** 強いランダム合言葉を生成して接続（この端末の内容を初期データに）。 */
  createAndConnect: () => Promise<void>;
  /** 任意の合言葉で接続（既存あれば取り込み／無ければローカルを push）。 */
  connect: (code: string) => Promise<SyncStatus>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
}

export function useSync(): UseSync {
  const configured = syncConfigured();
  // SyncSettings はクライアント操作で初めてマウントされるため
  // 遅延初期化で十分（SSR ミスマッチの懸念なし）。
  const [code, setCode] = useState<string | null>(() =>
    typeof window !== "undefined" ? getSyncCode() : null,
  );
  const [busy, setBusy] = useState(false);
  const [lastStatus, setLastStatus] = useState<SyncStatus | null>(null);

  const maybeReload = (status: SyncStatus) => {
    if (status === "pulled" || status === "conflict-remote") {
      window.location.reload();
    }
  };

  const connect = useCallback(async (input: string): Promise<SyncStatus> => {
    const trimmed = input.trim();
    if (!isValidSyncCode(trimmed)) return "error";
    setBusy(true);
    try {
      const r = await connectWithCode(trimmed);
      setCode(getSyncCode());
      setLastStatus(r.status);
      if (r.status === "pulled") {
        window.location.reload();
      }
      return r.status;
    } finally {
      setBusy(false);
    }
  }, []);

  const createAndConnect = useCallback(async () => {
    setBusy(true);
    try {
      const fresh = generateSyncCode();
      const r = await connectWithCode(fresh);
      setCode(getSyncCode());
      setLastStatus(r.status);
      maybeReload(r.status);
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectSync();
    setCode(null);
    setLastStatus(null);
  }, []);

  const syncNow = useCallback(async () => {
    setBusy(true);
    try {
      const r = await runSync({
        confirmConflict: () =>
          window.confirm(
            "別端末の変更がサーバにあります。\n" +
              "OK: サーバの内容を取り込む\n" +
              "キャンセル: この端末の内容で上書きする",
          ),
      });
      setLastStatus(r.status);
      maybeReload(r.status);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    configured,
    code,
    busy,
    lastStatus,
    createAndConnect,
    connect,
    disconnect,
    syncNow,
  };
}
