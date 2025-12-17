"use client";

import Link from "next/link";

export default function BillingManagePage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-base font-semibold text-slate-900">プランを管理</h1>
      <p className="mt-1 text-xs text-slate-600">解約/更新などの管理機能は準備中です。</p>

      <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
        現時点ではステータス表示と導線のみ提供しています。
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
