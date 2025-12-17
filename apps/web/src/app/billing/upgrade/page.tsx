"use client";

import Link from "next/link";

export default function BillingUpgradePage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-base font-semibold text-slate-900">プレミアムにする</h1>
      <p className="mt-1 text-xs text-slate-600">決済連携は準備中です。まずは導線だけ用意しています。</p>

      <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
        現在はデモ表示です。Stripe / RevenueCat のどちらかで実装予定。
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href="/billing"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
        >
          プラン状況に戻る
        </Link>
        <Link
          href="/concierge"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
        >
          コンシェルジュへ戻る
        </Link>
      </div>
    </div>
  );
}
