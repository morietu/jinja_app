// apps/web/src/app/concierge/history/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ChatEvent } from "@/features/concierge/types/chat";

type EventsByThread = Record<number, ChatEvent[]>;
const STORAGE_KEY = "concierge:eventsByThread";

function loadEventsByThread(): EventsByThread {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EventsByThread) : {};
  } catch {
    return {};
  }
}

function saveEventsByThread(map: EventsByThread) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota / private mode 等は無視
  }
}

type ThreadCard = {
  tid: number;
  title: string;
  preview: string;
  lastAt: string | null;
  count: number;
};

function deriveThreadCard(tid: number, evs: ChatEvent[]): ThreadCard {
  const count = evs.length;
  const lastAt = count > 0 ? (evs[count - 1]?.at ?? null) : null;

  // title: 最初の user_message 先頭（なければ Thread表記）
  let title = tid === 0 ? "新規(下書き)" : `Thread #${tid}`;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (e.type === "user_message" && e.text.trim()) {
      title = e.text.trim().slice(0, 24);
      break;
    }
  }

  // preview: 最後の user_message 優先 → なければ最後の assistant_reply
  let preview = "";
  for (let i = evs.length - 1; i >= 0; i--) {
    const e = evs[i];
    if (e.type === "user_message" && e.text.trim()) {
      preview = e.text.trim();
      break;
    }
  }
  if (!preview) {
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i];
      if (e.type === "assistant_reply" && e.text.trim()) {
        preview = e.text.trim();
        break;
      }
    }
  }

  return { tid, title, preview, lastAt, count };
}

export default function ConciergeHistoryPage() {
  const [map, setMap] = useState<EventsByThread>({});

  useEffect(() => {
    setMap(loadEventsByThread());
  }, []);

  // ✅ 一覧表示用に “スレッド配列” を導出（最新順）
  const threads = useMemo(() => {
    const ids = Object.keys(map)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n));

    const cards = ids.map((tid) => deriveThreadCard(tid, map[tid] ?? []));

    // 最新が上（lastAt desc）。lastAt null は下へ
    cards.sort((a, b) => {
      if (!a.lastAt && !b.lastAt) return a.tid - b.tid;
      if (!a.lastAt) return 1;
      if (!b.lastAt) return -1;
      return a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : b.tid - a.tid;
    });

    return cards;
  }, [map]);

  // --- ②削除 は次のセクションで入れる（ここに関数だけ置く） ---
  const handleDelete = (tid: number) => {
    setMap((prev) => {
      const next: EventsByThread = { ...prev };
      delete next[tid];
      saveEventsByThread(next);
      return next;
    });
  };

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <h1 className="mb-2 text-base font-semibold text-gray-800">相談履歴</h1>
      <Link
        href="/concierge"
        className="mb-3 inline-flex items-center rounded-md border bg-white px-3 py-2 text-xs font-semibold text-slate-900"
      >
        ← チャットへ戻る
      </Link>
      <p className="mb-4 text-xs text-gray-500">ローカル保存のスレッド一覧です。</p>

      {threads.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">
          まだ履歴はありません。
          <Link href="/concierge" className="ml-1 text-amber-600 underline">
            AIコンシェルジュへ
          </Link>
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {threads.map((t) => (
            <li key={t.tid} className="rounded-lg border bg-white px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/concierge?tid=${t.tid}`} className="min-w-0 flex-1 hover:underline">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-800">{t.title}</span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {t.lastAt ? new Date(t.lastAt).toLocaleString("ja-JP") : "日時なし"}
                    </span>
                  </div>
                  {t.preview && <p className="mt-1 line-clamp-2 text-[11px] text-gray-600">{t.preview}</p>}
                  <p className="mt-1 text-[10px] text-gray-400">events: {t.count}</p>
                </Link>

                {/* ② 削除（最小） */}
                <button
                  type="button"
                  onClick={() => handleDelete(t.tid)}
                  className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
