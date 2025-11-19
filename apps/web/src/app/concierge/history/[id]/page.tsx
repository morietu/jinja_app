// apps/web/src/app/concierge/history/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchThread() {
      try {
        setError(null);

        const res = await fetch(`${API_BASE}/concierge-threads/${threadId}/`, {
          credentials: "include",
        });

        if (res.status === 401) {
          throw new Error("auth-required");
        }
        if (res.status === 404) {
          throw new Error("not-found");
        }
        if (!res.ok) {
          throw new Error("failed");
        }

        const data: ThreadDetail = await res.json();
        setThread(data);
      } catch (e) {
        const msg =
          e instanceof Error && e.message === "auth-required"
            ? "この相談履歴を見るにはログインが必要です。"
            : e instanceof Error && e.message === "not-found"
              ? "この相談履歴は見つかりませんでした。"
              : "相談履歴の読み込みに失敗しました。時間をおいてもう一度お試しください。";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (!Number.isNaN(threadId)) {
      void fetchThread();
    }
  }, [threadId]);

  function handleContinue() {
    router.push(`/concierge?threadId=${threadId}`);
  }

  return (
    <section className="px-4 py-4 max-w-md mx-auto space-y-3">
      <header className="flex items-center justify-between mb-2">
        <Link href="/concierge/history" className="text-xs text-gray-500 underline active:opacity-70">
          ← 履歴一覧へ戻る
        </Link>
        <h1 className="text-sm font-semibold">相談履歴</h1>
      </header>

      {loading && <p className="text-xs text-gray-500 mt-2">相談履歴を読み込んでいます…</p>}

      {!loading && error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      {!loading && thread && !error && (
        <>
          <h2 className="text-base font-semibold mb-1">{thread.title}</h2>

          <div className="border rounded-xl p-3 h-[60vh] overflow-y-auto bg-white shadow-sm text-sm space-y-2">
            {thread.messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={[
                      "inline-block px-3 py-2 rounded-2xl max-w-[80%] text-xs leading-relaxed",
                      isUser ? "bg-black text-white" : "bg-gray-100 text-gray-900",
                    ].join(" ")}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={loading || !!error || !thread}
            className="w-full mt-3 inline-flex items-center justify-center rounded-full px-4 py-3 min-h-[44px] text-sm font-semibold bg-black text-white shadow-md disabled:bg-gray-300 disabled:shadow-none active:scale-[0.98] transition"
          >
            この相談の続きでコンシェルジュに聞く
          </button>
        </>
      )}
    </section>
  );
}
