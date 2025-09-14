// apps/web/src/app/plan/PlanView.tsx
"use client";

import { useEffect, useState } from "react";
// import { useSearchParams } from "next/navigation"; ← 使わない

type InitialQuery = {
  q?: string;
  tab?: string;
  page?: number;
  // 追加したキーがあればここにも生やす
  // date?: string;
  // from?: string;
  // to?: string;
  // tags?: string[];
};

export default function PlanView({ initialQuery }: { initialQuery: InitialQuery }) {
  const [q, setQ] = useState(initialQuery.q ?? "");
  const [tab, setTab] = useState(initialQuery.tab ?? "overview");
  const [page, setPage] = useState(initialQuery.page ?? 1);

  // もし初期スクロールや初期ロードがあればここで
  useEffect(() => {
    // 例: if (tab === "map") scrollToMap();
  }, [tab]);

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">参拝プラン</h1>

      {/* 例：検索欄 */}
      <div className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="キーワード"
          className="border p-2 rounded w-full"
        />
      </div>

      {/* 例：タブ */}
      <div className="mb-4 flex gap-2">
        <button
          className={`px-3 py-1 rounded ${tab === "overview" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => setTab("overview")}
        >
          概要
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "route" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => setTab("route")}
        >
          ルート
        </button>
      </div>

      {/* 例：ページネーション */}
      <div className="mb-6">
        <button
          className="px-3 py-1 border rounded mr-2"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          前へ
        </button>
        <span className="text-sm">ページ: {page}</span>
        <button className="px-3 py-1 border rounded ml-2" onClick={() => setPage((p) => p + 1)}>
          次へ
        </button>
      </div>

      {/* ここに既存の結果リストや地図などを配置 */}
    </main>
  );
}
