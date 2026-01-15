// apps/web/src/features/concierge/components/ChatPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ConciergeMessage, ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";
import ChatInput from "./ChatInput";
import RecommendationUnit from "@/components/concierge/RecommendationUnit";

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
  needTags?: string[];
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
  needTags = [],
  onNewThread,
}: Props) {
  // ✅ 非embedの「唯一のスクロール領域」
  const listRef = useRef<HTMLDivElement | null>(null);

  const [autoScroll, setAutoScroll] = useState(true);
  const [flashStatus, setFlashStatus] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // embed: おすすめの開閉（デフォで閉じておく＝画面を守る）
  const [recsOpen, setRecsOpen] = useState(false);

  // ✅ 非embed: 下端付近だけおすすめ表示（スクロールでしまう）
  const [showRecs, setShowRecs] = useState(true);
  const [pinRecs, setPinRecs] = useState(false);

  // ✅ 非embed: 追加候補（2,3件目）は「到達したら開く」
  const [moreOpen, setMoreOpen] = useState(false);
  const moreSentinelRef = useRef<HTMLDivElement | null>(null);

  // おすすめが更新されたら「2,3件目は閉じる」
  useEffect(() => {
    if (!recommendations.length) return;
    setMoreOpen(false);
  }, [recommendations.length]);

  // ✅ 2,3件目の “自動展開” = sentinel到達で moreOpen=true
  useEffect(() => {
    if (embedMode) return;
    if (recommendations.length <= 1) return;

    const rootEl = listRef.current;
    const sentinel = moreSentinelRef.current;
    if (!rootEl || !sentinel) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMoreOpen(true); // ✅ ここで “scroll領域が伸びる”
        }
      },
      {
        root: rootEl, // ✅ listRef がスクロールコンテナ
        threshold: 0.1,
        rootMargin: "120px",
      },
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [embedMode, recommendations.length]);

  // 非embed用：メッセージ追加時の自動スクロール
  useEffect(() => {
    if (embedMode) return;
    const el = listRef.current;
    if (!el || !autoScroll) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll, embedMode]);

  // 非embed：おすすめが出たタイミングでも下へ寄せる
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

  // ✅ 下端付近だけおすすめを出す（= 入力体験の一部）
  const handleScroll = () => {
    if (embedMode) return;
    if (pinRecs) return;

    const el = listRef.current;
    if (!el) return;

    const bottomGap = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const THRESHOLD = 180;

    setShowRecs(bottomGap <= THRESHOLD);
  };

  // 初回/更新時にも一度判定
  useEffect(() => {
    if (embedMode) return;
    const id = window.setTimeout(() => handleScroll(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedMode, recommendations.length, pinRecs]);

  // -----------------------------
  // ✅ embedMode: 入力 +（折りたたみ）おすすめ
  // -----------------------------
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

        {recommendations.length > 0 && (
          <div className="border-t bg-white">
            <button
              type="button"
              onClick={() => setRecsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-3 text-left"
            >
              <div>
                <div className="text-xs font-semibold text-gray-700">今回のおすすめ</div>
                {!recsOpen && (
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    タップして表示（{Math.min(3, recommendations.length)}件）
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500">{recsOpen ? "閉じる" : "開く"}</span>
            </button>

            {recsOpen && (
              <div className="px-3 pb-3">
                <div className="max-h-[38vh] overflow-y-auto pr-1">
                  <section className="space-y-3">
                    {recommendations.slice(0, 3).map((rec, idx) => (
                      <RecommendationUnit
                        key={rec.id ?? rec.place_id ?? idx}
                        rec={rec}
                        index={idx}
                        needTags={needTags}
                      />
                    ))}
                  </section>

                  <div className="mt-4 grid gap-2">
                    <Link
                      href="/concierge/history"
                      className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                      onClick={onNewThread}
                    >
                      条件を追加して絞る（履歴へ）
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -----------------------------
  // ✅ 非embed（スクロール領域1つ + 下端付近でおすすめ表示）
  // -----------------------------
  return (
    <div className="flex h-dvh flex-col bg-white">
      {/* ✅ ① スクロール領域（ここだけ） */}
      <div ref={listRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        <div className="space-y-2">
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
        </div>

        {/* ✅ ② おすすめ（下端付近だけ表示） */}
        {recommendations.length > 0 && showRecs && (
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold text-gray-700">今回のおすすめ</h3>

              <div className="flex items-center gap-2">
                {recommendations.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600">
                    他の候補（{Math.min(2, recommendations.length - 1)}件）
                  </span>
                )}

                {/* ✅ 手動ピン（不要なら消してOK） */}
                <button
                  type="button"
                  onClick={() => setPinRecs((v) => !v)}
                  className="text-[11px] font-semibold text-slate-600 hover:underline"
                >
                  {pinRecs ? "固定解除" : "固定"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {/* 1件目 */}
              <RecommendationUnit
                key={recommendations[0].id ?? recommendations[0].place_id ?? 0}
                rec={recommendations[0]}
                index={0}
                needTags={needTags}
              />

              {/* sentinel */}
              {recommendations.length > 1 && <div ref={moreSentinelRef} className="h-2" />}

              {/* 到達後に2〜3件目 */}
              {moreOpen &&
                recommendations
                  .slice(1, 3)
                  .map((rec, idx) => (
                    <RecommendationUnit
                      key={rec.id ?? rec.place_id ?? idx + 1}
                      rec={rec}
                      index={idx + 1}
                      needTags={needTags}
                    />
                  ))}
            </div>

            <div className="mt-3">
              <Link
                href="/concierge/history"
                className="block rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                onClick={onNewThread}
              >
                条件を追加して絞る（履歴へ）
              </Link>
            </div>
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* ✅ ③ 入力欄（固定） */}
      <div className="border-t bg-white px-3 py-3">
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
