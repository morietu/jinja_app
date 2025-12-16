"use client";

import Link from "next/link";
import { useBilling } from "@/features/billing/hooks/useBilling";

function Spinner() {
  return <div className="py-6 text-center text-sm text-slate-500">読み込み中…</div>;
}

function ErrorView({ message }: { message: string }) {
  return <div className="py-6 text-center text-sm text-red-600">{message}</div>;
}

export default function BillingPage() {
  const billing = useBilling();

  if (billing.loading) return <Spinner />;
  if (billing.error) return <ErrorView message={billing.error} />;

  const s = billing.status!;

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

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">プラン</dt>
            <dd className="font-medium">{s.plan}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">有効</dt>
            <dd className="font-medium">{s.is_active ? "はい" : "いいえ"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">プロバイダ</dt>
            <dd className="font-medium">{s.provider}</dd>
          </div>
        </dl>
      </section>

      {/* 契約形状の確認（デバッグ用） */}
      <section className="rounded-xl border bg-white p-4 text-sm">
        <div className="mb-2 font-semibold">BillingStatus（contract）</div>
        <div className="space-y-1 text-slate-700">
          <div>current_period_end: {s.current_period_end ?? "-"}</div>
          <div>trial_ends_at: {s.trial_ends_at ?? "-"}</div>
          <div>cancel_at_period_end: {String(s.cancel_at_period_end)}</div>
        </div>

        <button type="button" onClick={billing.refresh} className="mt-3 rounded-md border px-3 py-2 text-sm">
          更新
        </button>
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
