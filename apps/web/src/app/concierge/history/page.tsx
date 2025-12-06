// apps/web/src/app/concierge/history/page.tsx
"use client";

import Link from "next/link";
import { useConciergeThreads } from "@/features/concierge/hooks";

export default function ConciergeHistoryPage() {
  const { threads, loading, error, requiresLogin, reload } = useConciergeThreads();

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-2 text-base font-semibold text-gray-800">相談履歴</h1>
      <p className="mb-4 text-xs text-gray-500">過去にAIコンシェルジュに相談した内容を一覧で確認できます。</p>

      {loading && <p className="text-xs text-gray-500">読み込み中です…</p>}

      {error && !loading && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          履歴の取得に失敗しました。
          <button type="button" onClick={() => reload()} className="ml-2 underline">
            もう一度試す
          </button>
        </div>
      )}

      {requiresLogin && (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
          ログインすると、過去の相談履歴を確認できます。
        </div>
      )}

      {!loading && !requiresLogin && threads.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">
          まだ相談履歴はありません。まずは
          <Link href="/concierge" className="text-amber-600 underline">
            AIコンシェルジュ
          </Link>
          から相談してみてください。
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {threads.map((t) => (
          <li key={t.id}>
            <Link
              href={`/concierge/history/${t.id}`}
              className="block rounded-lg border bg-white px-3 py-2 text-xs hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-gray-800">{t.title || "相談スレッド"}</span>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {t.last_message_at ? new Date(t.last_message_at).toLocaleString("ja-JP") : "日時なし"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-gray-600">{t.last_message}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
