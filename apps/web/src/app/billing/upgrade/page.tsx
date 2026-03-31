"use client";

import Link from "next/link";

export default function BillingUpgradePage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">もっと自分に合う神社提案を受け取りたい方へ</h1>
        <p className="text-sm leading-6 text-slate-600">
          プレミアムでは、より継続的にコンシェルジュ体験を使いやすくしていく予定です。
        </p>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">無料プランとの違い</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-900">無料</p>
            <p className="mt-1 text-slate-600">
              まずは気軽にコンシェルジュを試したい方向け。基本的な神社提案を利用できます。
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="font-medium text-slate-900">プレミアム</p>
            <p className="mt-1 text-slate-600">
              継続的に使いたい方向け。より自分に合った提案体験や、今後の拡張機能を使いやすくしていく予定です。
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">
        プレミアム機能は現在順次準備中です。利用可能になり次第、この画面から案内します。
      </section>

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/concierge"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          無料でコンシェルジュを使う
        </Link>
        <Link
          href="/billing"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
        >
          プラン状況を確認する
        </Link>
      </div>
    </div>
  );
}
