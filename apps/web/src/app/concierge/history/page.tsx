// apps/web/src/app/concierge/history/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConciergeHistoryItem } from "@/features/concierge/types";




export default function ConciergeHistoryPage() {
  const [items, setItems] = useState<ConciergeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: 必要なら専用APIクライアントに切り出す
    async function fetchHistory() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000/api"}/concierge/history/`,
          { credentials: "include" },
        );
        const data = await res.json();
        setItems(data.results ?? data); // backendの形式に合わせて調整
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <section className="px-4 py-4 max-w-md mx-auto space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">コンシェルジュ履歴</h1>
        <Link href="/concierge" className="text-[11px] text-gray-500 underline">
          新しく相談する
        </Link>
      </header>

      {loading && <p className="text-xs text-gray-500">読み込み中です…</p>}

      {!loading && !items.length && (
        <p className="text-xs text-gray-500">
          まだ相談履歴がありません。
          <br />
          まずは「今の気持ちから神社を探す」から相談してみてください。
        </p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/concierge/history/${item.id}`}
            className="flex flex-col gap-1 rounded-xl border bg-white px-3 py-2 text-xs shadow-sm active:scale-[0.99] transition"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{item.title || "タイトル未設定の相談"}</p>
              {item.last_message_at && <span className="text-[10px] text-gray-500">{item.last_message_at}</span>}
            </div>
            {item.last_message && <p className="text-[11px] text-gray-600 truncate">{item.last_message}</p>}
            <span className="text-[10px] text-gray-400">{item.message_count} 件のメッセージ</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
