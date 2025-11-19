// apps/web/src/app/concierge/page.tsx
"use client";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";

export default function ConciergePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col p-4">
      {/* ヘッダー：タイトル＋履歴 */}
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span>AI神社コンシェルジュ</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            
          </span>
        </h1>

        {/* 説明は一文だけにする */}
        <p className="text-xs text-gray-500">いまの気持ちを送ると、合いそうな神社と回り方を提案します。</p>
      </header>
      {/* 本体：ここから下を丸ごとチャット画面として扱う */}
      <div className="flex-1">
        <ConciergeLayout />
      </div>
    </main>
  );
}
