// apps/web/src/app/concierge/ConciergeClientEmbed.tsx
"use client";

import { useRouter } from "next/navigation";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";

export default function ConciergeClientEmbed() {
  const router = useRouter();

  return (
    <ConciergeLayout
      messages={[]}
      sending={false}
      error={null}
      onSend={() => {}}
      onRetry={() => {}}
      canSend={false}
      embedMode
      lastQuery="" // もう固定seedは渡さない（任意）
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">ここは入口。おすすめ本体はコンシェルジュ画面で出します。</p>

        <button
          type="button"
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold hover:bg-emerald-700"
          onClick={() => router.push("/concierge?mode=feel")}
        >
          今の気持ちから神社を探す
        </button>
      </div>
    </ConciergeLayout>
  );
}
