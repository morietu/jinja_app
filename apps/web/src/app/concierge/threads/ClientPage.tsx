// apps/web/src/app/concierge/threads/ClientPage.tsx
"use client";

import Link from "next/link";
import { useConciergeThreads } from "@/features/concierge/hooks";

export default function ConciergeThreadsClientPage() {
  const { threads, loading, error, requiresLogin } = useConciergeThreads();

  const hasThreads = threads.length > 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      {/* ヘッダー */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">コンシェルジュ履歴</h1>
          <p className="mt-1 text-xs text-gray-500">過去の相談スレッドを一覧で確認できます。</p>
        </div>
        <Link href="/concierge" className="text-xs text-blue-600 underline underline-offset-2">
          コンシェルジュに戻る
        </Link>
      </header>

      {/* 状態表示 */}
      {requiresLogin && (
        <p className="text-xs text-red-500">
          履歴を見るにはログインが必要です。右上の「ログイン」からサインインしてください。
        </p>
      )}

      {error && !requiresLogin && (
        <p className="text-xs text-red-500">履歴の取得に失敗しました。時間をおいて再度お試しください。</p>
      )}

      {loading && <p className="text-xs text-gray-500">読み込み中…</p>}

      {/* 本文 */}
      {!loading && !hasThreads && !error && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
          まだスレッドがありません。
          <br />
          <span className="text-xs">「コンシェルジュ」画面から質問すると、ここに履歴が表示されます。</span>
        </div>
      )}

      {!loading && hasThreads && (
        <ul className="divide-y rounded-lg border bg-white">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/concierge/threads/${t.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{t.title || "無題のスレッド"}</p>
                  {t.last_message_at ? (
                    <p className="whitespace-nowrap text-[11px] text-gray-400">{t.last_message_at}</p>
                  ) : null}
                </div>

                {t.last_message ? (
                  <p className="line-clamp-2 text-xs text-gray-500">{t.last_message}</p>
                ) : (
                  <p className="text-xs text-gray-400">メッセージなし</p>
                )}

                <p className="mt-1 text-[11px] text-gray-400">{t.message_count} 件のメッセージ</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
