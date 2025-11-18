// apps/web/src/app/concierge/history/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ChatMessageItem } from "@/features/concierge/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000/api";

type ThreadDetail = {
  id: number;
  title: string;
  messages: {
    id: string;
    role: "user" | "assistant";
    text: string;
    created_at: string;
  }[];
};

export default function ConciergeThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const threadId = Number(params.id);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchThread() {
      try {
        const res = await fetch(`${API_BASE}/concierge-threads/${threadId}/`, {
          credentials: "include",
        });
        const data = await res.json();
        setThread(data);
      } finally {
        setLoading(false);
      }
    }
    if (!Number.isNaN(threadId)) {
      fetchThread();
    }
  }, [threadId]);

  function handleContinue() {
    router.push(`/concierge?threadId=${threadId}`);
  }

  return (
    <section className="px-4 py-4 max-w-md mx-auto space-y-3">
      <header className="flex items-center justify-between">
        <Link href="/concierge/history" className="text-[11px] text-gray-500 underline">
          履歴一覧へ戻る
        </Link>
        <h1 className="text-sm font-semibold">相談履歴</h1>
      </header>

      {loading && <p className="text-xs text-gray-500">読み込み中です…</p>}

      {!loading && thread && (
        <>
          <h2 className="text-base font-semibold mb-1">{thread.title}</h2>

          <div className="border rounded-xl p-3 h-[50vh] overflow-y-auto bg-white shadow-sm text-sm">
            {thread.messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right mb-2" : "text-left mb-2"}>
                <div className="inline-block px-3 py-2 rounded-2xl bg-gray-100 max-w-[80%] text-left">{m.text}</div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="w-full mt-3 inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold bg-black text-white shadow-md active:scale-[0.98] transition"
          >
            この相談の続きでコンシェルジュに聞く
          </button>
        </>
      )}
    </section>
  );
}
