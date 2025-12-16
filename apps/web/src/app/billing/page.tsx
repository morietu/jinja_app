"use client";

import Link from "next/link";
import { useBilling } from "@/features/billing/hooks/useBilling";

export default function BillingPage() {
  const { status, loading, error } = useBilling();

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">プレミアム</h1>
        <Link href="/concierge" className="text-sm text-gray-600 underline hover:text-gray-900">
          戻る
        </Link>
      </header>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">現在のステータス</div>

        {loading && <p className="mt-2 text-sm text-gray-500">読み込み中…</p>}
        {!loading && error && <p className="mt-2 text-sm text-red-600">ステータス取得に失敗しました: {error}</p>}

        {!loading && !error && (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">プラン</dt>
              <dd className="font-medium">{status?.plan ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">有効</dt>
              <dd className="font-medium">{status?.is_active ? "はい" : "いいえ"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">プロバイダ</dt>
              <dd className="font-medium">{status?.provider ?? "-"}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-xl border bg-gray-50 p-4">
        <div className="text-sm font-semibold">準備中</div>
        <p className="mt-2 text-sm text-gray-700">
          現在は課金導線の土台だけ先に実装しています。今後ここに「プラン選択」「支払い」「解約」などを追加します。
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded bg-slate-900 px-4 py-2 text-sm text-white opacity-50"
          >
            プランを選ぶ（準備中）
          </button>
          <Link href="/mypage" className="rounded border px-4 py-2 text-sm hover:bg-white">
            マイページへ
          </Link>
        </div>
      </section>
    </main>
  );
}
