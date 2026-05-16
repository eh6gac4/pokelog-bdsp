"use client";

import { useEffect } from "react";

// /sw.js を登録するだけの UI 無しコンポーネント。
// SW は HTTPS または localhost（secure context）でのみ登録される。
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloaded = false;
    const onControllerChange = () => {
      // 新しい SW が制御を取得したら一度だけリロードして更新を反映。
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // 登録失敗（非対応・非 secure context 等）は無視。
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
