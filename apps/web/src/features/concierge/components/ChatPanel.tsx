// apps/web/src/features/concierge/components/ChatPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ConciergeMessage, ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";
import ChatInput from "./ChatInput";
import RecommendationUnit from "@/components/concierge/RecommendationUnit";
import { useSearchParams } from "next/navigation";

type Props = {
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSend: (text: string) => void | Promise<void>;
  canSend: boolean;
  embedMode?: boolean;
  recommendations?: ConciergeRecommendation[];
  onNewThread?: () => void;
};

function isAuthError(err: string | null) {
  if (!err) return false;
  return err.includes("401") || err.toLowerCase().includes("unauthorized");
}

export default function ChatPanel({
  thread: _thread,
  messages,
  loading = false,
  sending = false,
  error = null,
  onRetry,
  onSend,
  canSend = true,
  embedMode = false,
  recommendations = [],
  onNewThread,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [flashStatus, setFlashStatus] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // 非embed用：メッセージ追加時の自動スクロール
  useEffect(() => {
    if (embedMode) return;
    const el = listRef.current;
    if (!el || !autoScroll) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll, embedMode]);

  // ✅ おすすめが出たタイミングでも下へ寄せる（四角枠だけ見えて「下に出る」を減らす）
  useEffect(() => {
    if (embedMode) return;
    if (!recommendations.length) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [recommendations.length, embedMode]);

  const handleSend = async (text: string) => {
    if (!canSend) return;
    const trimmed = text.trim();
    if (!trimmed || sending || loading) return;

    if (embedMode) {
      setFlashStatus("更新中…");
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    }

    await onSend(trimmed);
    setAutoScroll(true);
  };

  useEffect(() => {
    if (!embedMode) return;
    if (!sending && !loading && flashStatus === "更新中…") {
      setFlashStatus("更新しました");
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => {
        setFlashStatus(null);
        flashTimerRef.current = null;
      }, 1200);
    }
  }, [embedMode, sending, loading, flashStatus]);

  const authError = isAuthError(error);
  const goLogin = () => {
    const next = `${location.pathname}${location.search}`;
    location.href = `/login?next=${encodeURIComponent(next)}`;
  };

  const sp = useSearchParams();
  const tid = sp.get("tid");

  const q = new URLSearchParams();
  if (tid) q.set("tid", tid);

  const mapBrowseHref = q.toString() ? `/map?${q.toString()}` : "/map";

  // ✅ embedMode: 入力パネルだけ
  if (embedMode) {
    return (
      <div className="rounded-2xl border bg-white shadow-sm">
        {error && (
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="mr-3 line-clamp-2">
              {authError ? "ログイン期限が切れました。もう一度ログインしてください。" : error}
            </span>
            {authError ? (
              <button
                type="button"
                onClick={goLogin}
                className="shrink-0 rounded-full border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700"
              >
                ログイン
              </button>
            ) : onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 rounded-full border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700"
              >
                もう一度試す
              </button>
            ) : null}
          </div>
        )}

        <div className="px-3 py-2">
          {flashStatus && (
            <div className="mb-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">{flashStatus}</div>
          )}

          <ChatInput disabled={sending || loading || !canSend} onSend={handleSend} error={error} embedMode />

          {!canSend && (
            <p className="mt-2 text-xs text-slate-600">
              無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- ここから下は非embedの従来表示（会話UI + 枠内おすすめ） ----
  return (
    <div className="flex h-[calc(100vh-180px)] flex-col rounded-2xl border bg-white shadow-sm">
      {/* メッセージ一覧 */}
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !loading && !sending && (
          <div className="mt-6 rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600">
            いまの状況や相談したいことを、自由に送ってください。
            <br />
            例：
            <br />
            ・「今年の恋愛運を上げたい」
            <br />
            ・「転職活動の区切りでお参りしたい」 など
          </div>
        )}

        {messages.map((m) => {
          const dt = new Date(m.created_at);
          const timeLabel = `${dt.getHours().toString().padStart(2, "0")}:${dt
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;

          return (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-emerald-600 text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.content}
                </div>
                <p className={`mt-0.5 text-[10px] text-gray-400 ${m.role === "user" ? "text-right" : "text-left"}`}>
                  {timeLabel}
                </p>
              </div>
            </div>
          );
        })}

        {(loading || sending) && (
          <div className="mt-2 flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-xs text-gray-600">考え中…</div>
          </div>
        )}

        {/* ✅ 枠内おすすめ */}
        {recommendations.length > 0 && (
          <div className="mt-4 border-t pt-3 pb-2">
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-gray-700">今回のおすすめ</h3>
            </div>

            <section className="space-y-3">
              {recommendations.slice(0, 3).map((rec, idx) => (
                <RecommendationUnit key={rec.id ?? rec.place_id ?? idx} rec={rec} index={idx} />
              ))}
            </section>

            <div className="mt-3 text-[11px] text-slate-600">
              気になる神社があれば「地図で見る」で場所を確認できます。
            </div>

            <div className="mt-4 grid gap-2">
              <Link
                href={mapBrowseHref}
                className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              >
                他も見て選ぶ（地図）
              </Link>

              <Link
                href="/concierge/history"
                className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                onClick={onNewThread}
              >
                条件を追加して絞る（履歴へ）
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* エラーバナー（401はログイン導線） */}
      {error && (
        <div className="flex items-center justify-between border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="mr-3 line-clamp-2">
            {authError ? "ログイン期限が切れました。もう一度ログインしてください。" : error}
          </span>
          {authError ? (
            <button
              type="button"
              onClick={goLogin}
              className="shrink-0 rounded-full border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700"
            >
              ログイン
            </button>
          ) : onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-full border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700"
            >
              もう一度試す
            </button>
          ) : null}
        </div>
      )}

      {/* 入力欄 */}
      <div className="border-t px-3 py-3">
        <ChatInput disabled={sending || loading || !canSend} onSend={handleSend} error={error} />
        {!canSend && (
          <p className="mt-2 text-xs text-slate-600">
            無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
          </p>
        )}
      </div>
    </div>
  );
}
