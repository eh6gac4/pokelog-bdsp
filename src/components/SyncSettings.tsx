"use client";

import { useState } from "react";
import { useSync } from "@/hooks/useSync";
import { FIELD_CLASS } from "@/lib/fieldClass";

const STATUS_LABEL: Record<string, string> = {
  noop: "同期済み（変更なし）",
  pushed: "この端末の内容をアップロードしました",
  pulled: "サーバの内容を取り込みました",
  "conflict-remote": "競合: サーバの内容を採用しました",
  "conflict-local": "競合: この端末の内容で上書きしました",
  error: "同期に失敗しました（接続を確認してください）",
  idle: "未設定",
};

interface Props {
  onClose: () => void;
}

export function SyncSettings({ onClose }: Props) {
  const sync = useSync();
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!sync.code) return;
    try {
      await navigator.clipboard.writeText(sync.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* クリップボード不可は無視 */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-1">端末間同期</h2>
        <p className="text-xs text-gray-500 mb-4">
          同期コードは合言葉です。
          <span className="text-red-500">
            コードを知る人は誰でもこのデータを閲覧・編集できます。
          </span>
          メモアプリ等に控えてください。
        </p>

        {sync.code ? (
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-gray-500">この端末の同期コード</span>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  className={`${FIELD_CLASS} flex-1 font-mono`}
                  value={sync.code}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {copied ? "コピー済" : "コピー"}
                </button>
              </div>
            </div>

            {sync.lastStatus && (
              <p className="text-xs text-gray-500">
                {STATUS_LABEL[sync.lastStatus] ?? sync.lastStatus}
              </p>
            )}

            <div className="flex justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={sync.disconnect}
                className="text-sm text-red-400 hover:text-red-600"
              >
                同期を解除
              </button>
              <button
                type="button"
                onClick={sync.syncNow}
                disabled={sync.busy}
                className="rounded-lg bg-blue-500 px-4 py-2 text-white font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {sync.busy ? "同期中…" : "今すぐ同期"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <button
              type="button"
              onClick={sync.createAndConnect}
              disabled={sync.busy}
              className="w-full rounded-lg bg-blue-500 px-4 py-2 text-white font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {sync.busy ? "準備中…" : "同期を有効化（コードを生成）"}
            </button>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <span className="text-gray-500">
                別端末のコードを入力して接続
              </span>
              <p className="text-xs text-gray-400 mt-1">
                接続するとこの端末のデータはサーバの内容で置き換わります。
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  className={`${FIELD_CLASS} flex-1 font-mono`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="同期コード"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => sync.connect(input)}
                  disabled={sync.busy || input.trim().length === 0}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  接続
                </button>
              </div>
              {sync.lastStatus === "error" && (
                <p className="text-xs text-red-500 mt-2">
                  接続に失敗しました。コードと通信状態を確認してください。
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
