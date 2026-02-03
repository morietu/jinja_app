"use client";

import Link from "next/link";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";

export default function ConciergeClientEmbed() {
  return (
    <ConciergeLayout
      messages={[]}
      sending={false}
      error={null}
      onSend={() => {}}
      onRetry={() => {}}
      canSend={false}
      embedMode
      lastQuery=""
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">ここは入口。おすすめ本体はコンシェルジュ画面で出します。</p>

        <Link
          href="/concierge"
          className="block w-full rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold hover:bg-emerald-700 text-center"
        >
          今の気持ちから神社を探す
        </Link>
      </div>
    </ConciergeLayout>
  );
}
