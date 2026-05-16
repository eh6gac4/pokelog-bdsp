"use client";

import { useEffect } from "react";
import {
  CHANGE_EVENT,
  getSyncCode,
  runSync,
  syncConfigured,
} from "@/lib/sync";

// バックグラウンド同期のトリガを束ねる UI 無しコンポーネント。
// 起動時 / フォアグラウンド復帰 / オンライン復帰 / データ変更（デバウンス）
// で runSync を呼ぶ。リモート反映時は再読込してフックを再ハイドレート。
export function SyncManager() {
  useEffect(() => {
    if (!syncConfigured()) return;

    let disposed = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let reloaded = false;

    const confirmConflict = () =>
      window.confirm(
        "別端末の変更がサーバにあります。\n" +
          "OK: サーバの内容を取り込む（この端末の未同期変更は破棄）\n" +
          "キャンセル: この端末の内容で上書きする",
      );

    const sync = async () => {
      if (disposed) return;
      const r = await runSync({ confirmConflict });
      if (disposed || reloaded) return;
      if (r.status === "pulled" || r.status === "conflict-remote") {
        // 取り込んだ内容で各フックを再ハイドレートさせる。
        reloaded = true;
        window.location.reload();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    const onChange = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(sync, 3000);
    };

    // 起動時（コードがある時だけ）
    if (getSyncCode()) sync();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", sync);
    window.addEventListener(CHANGE_EVENT, onChange as EventListener);

    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", sync);
      window.removeEventListener(CHANGE_EVENT, onChange as EventListener);
    };
  }, []);

  return null;
}
