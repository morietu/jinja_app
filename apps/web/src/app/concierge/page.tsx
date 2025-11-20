// apps/web/src/app/concierge/page.tsx
"use client";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { ConciergeQuickActions } from "@/components/concierge/ConciergeQuickActions";

export default function ConciergePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col p-4">
      {/* ヘッダー：タイトル＋説明 */}
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span>AI神社コンシェルジュ</span>
        </h1>
        <p className="text-xs text-gray-500">いまの気持ちを送ると、合いそうな神社と回り方を提案します。</p>
      </header>

      {/* 本体：チャット */}
      <div className="mt-4 flex-1">
        <ConciergeLayout />
      </div>

      {/* フッター：共通のカードナビ（地図・マイページ・履歴など） */}
      <section className="mt-4">
        <ConciergeQuickActions variant="full" />
      </section>
    </main>
  );
}
