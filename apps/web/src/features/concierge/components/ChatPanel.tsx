// apps/web/src/features/concierge/components/ChatPanel.tsx
"use client";

import * as React from "react";
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

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

type SheetSnap = "closed" | "peek" | "open";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nearestSnap(y: number, closedY: number, peekY: number, openY: number): SheetSnap {
  const dist = (a: number, b: number) => Math.abs(a - b);
  const dClosed = dist(y, closedY);
  const dPeek = dist(y, peekY);
  const dOpen = dist(y, openY);
  if (dOpen <= dPeek && dOpen <= dClosed) return "open";
  if (dPeek <= dClosed) return "peek";
  return "closed";
}

/**
 * ✅ B案：BottomSheet（非embed専用）
 * - closed: つまみだけ
 * - peek/open: スワイプで開閉
 * - 2,3件目は sheet内スクロールで sentinel 到達で表示
 * - タップでも closed→peek→open→closed
 */
function decideSnapByThreshold(y: number, closedY: number, peekY: number, openY: number): SheetSnap {
  const midOpenPeek = (openY + peekY) / 2;
  const midPeekClosed = (peekY + closedY) / 2;

  if (y <= midOpenPeek) return "open";
  if (y <= midPeekClosed) return "peek";
  return "closed";
}

function RecsBottomSheet({
  recommendations,
  needTags,
  onNewThread,
}: {
  recommendations: ConciergeRecommendation[];
  needTags: string[];
  onNewThread?: () => void;
}) {
  const sheetScrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("closed");
  const [translateY, setTranslateY] = useState<number | null>(null); // null = 未初期化

  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);

  const movedRef = useRef(false);
  const TAP_SLOP = 6;

  const posRef = useRef({ openY: 0, peekY: 0, closedY: 0, maxY: 0 });

  // 初期/リサイズで高さ計算
  useEffect(() => {
    const recalc = () => {
      const vh = window.innerHeight || 800;

      const sheetH = Math.round(vh * 0.72);
      const peekVisible = 170;
      const closedVisible = 34;

      const openY = 0;
      const peekY = sheetH - peekVisible;
      const closedY = sheetH - closedVisible;

      posRef.current = { openY, peekY, closedY, maxY: closedY };

      // 現在のsnap状態に応じて位置を設定
      const y = snap === "open" ? openY : snap === "peek" ? peekY : closedY;
      setTranslateY(y);
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 初期化: closedYが計算されたら確実にclosed位置に設定
  useEffect(() => {
    if (translateY === null && posRef.current.closedY > 0) {
      setTranslateY(posRef.current.closedY);
    }
  }, [translateY]);

  // recommendations 更新時：閉じる + 2,3件目は閉じる
  useEffect(() => {
    if (!recommendations.length) return;
    setMoreOpen(false);
    setSnap("closed");
    setTranslateY(posRef.current.closedY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations.length]);

  // sentinel 到達で 2,3件目を解放
  useEffect(() => {
    if (recommendations.length <= 1) return;

    const rootEl = sheetScrollRef.current;
    const sentinel = sentinelRef.current;
    if (!rootEl || !sentinel) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setMoreOpen(true);
      },
      { root: rootEl, threshold: 0.1, rootMargin: "120px" },
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [recommendations.length]);

  const snapTo = (next: SheetSnap) => {
    const { openY, peekY, closedY } = posRef.current;
    const y = next === "open" ? openY : next === "peek" ? peekY : closedY;
    setSnap(next);
    setTranslateY(y);
  };

  const toggleSnap = () => {
    if (snap === "closed") snapTo("peek");
    else if (snap === "peek") snapTo("open");
    else snapTo("closed");
  };

  const handleRef = useRef<HTMLElement | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    movedRef.current = false;
    startYRef.current = e.clientY;
    startTranslateRef.current = translateY ?? posRef.current.closedY;
    handleRef.current = e.currentTarget as HTMLElement;
    handleRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dy = e.clientY - startYRef.current;

    if (Math.abs(dy) > TAP_SLOP) movedRef.current = true;

    const next = clamp(startTranslateRef.current + dy, 0, posRef.current.maxY);
    setTranslateY(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (handleRef.current) {
      handleRef.current.releasePointerCapture(e.pointerId);
      handleRef.current = null;
    }

    // タップ
    if (!movedRef.current) {
      toggleSnap();
      return;
    }

    // ドラッグ：thresholdで決定
    const { openY, peekY, closedY } = posRef.current;
    const currentY = translateY ?? closedY;
    const target = decideSnapByThreshold(currentY, closedY, peekY, openY);
    snapTo(target);
  };

  // translateYが未初期化の場合は何も表示しない（初期化待ち）
  if (translateY === null) {
    return null;
  }

  const block = snap === "open";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      {block && (
        <button
          type="button"
          aria-label="close"
          className="fixed inset-0 bg-transparent"
          onClick={() => snapTo("closed")}
        />
      )}

      <div className="w-full px-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div
          className="rounded-t-2xl border border-neutral-200 bg-white shadow-sm overscroll-contain"
          style={{
            height: "72vh",
            transform: `translateY(${translateY}px)`,
            transition: draggingRef.current ? "none" : "transform 180ms ease-out",
            willChange: "transform",
          }}
        >
          {/* handle */}
          <div
            className="px-3 pt-2 pb-1"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ touchAction: "none" }}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300" />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-gray-700">今回のおすすめ</div>
              {recommendations.length > 1 && (
                <div className="text-[11px] font-semibold text-slate-600">
                  他の候補（{Math.min(2, recommendations.length - 1)}件）
                </div>
              )}
            </div>
          </div>

          {/* content */}
          <div
            ref={sheetScrollRef}
            className="max-h-[calc(72vh-52px)] overflow-y-auto overscroll-contain px-3 pb-3"
            style={{ touchAction: "pan-y" }}
          >
            <div className="space-y-2 pt-2">
              <RecommendationUnit
                key={recommendations[0].id ?? recommendations[0].place_id ?? 0}
                rec={recommendations[0]}
                index={0}
                needTags={needTags}
              />

              {recommendations.length > 1 && <div ref={sentinelRef} className="h-2" />}

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

            <div className="h-8" />
          </div>

          <div className="sr-only">{snap}</div>
        </div>
      </div>
    </div>
  );
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
  const listRef = useRef<HTMLDivElement | null>(null);

  const [autoScroll, setAutoScroll] = useState(true);
  const [flashStatus, setFlashStatus] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // embed: 既存の折りたたみ
  const [recsOpen, setRecsOpen] = useState(false);

  // 非embed：メッセージ追加時の自動スクロール
  useEffect(() => {
    if (embedMode) return;
    const el = listRef.current;
    if (!el || !autoScroll) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll, embedMode]);

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

  // -----------------------------
  // embedMode（壊さない：従来の折りたたみUI）
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
  // 非embed（チャット + 入力 / おすすめは BottomSheet に隔離）
  // -----------------------------
  return (
    <div className="flex h-dvh flex-col bg-white">
      {/* ① スクロール領域（ここだけ） */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
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
            const timeLabel = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;

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

        <div className="h-10" />
      </div>

      {/* ② 入力欄（固定） */}
      <div className="border-t bg-white px-3 py-3">
        <ChatInput disabled={sending || loading || !canSend} onSend={handleSend} error={error} />
        {!canSend && (
          <p className="mt-2 text-xs text-slate-600">
            無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
          </p>
        )}
      </div>

      {/* ③ BottomSheet（非embedのみ） */}
      {recommendations.length > 0 && (
        <RecsBottomSheet recommendations={recommendations.slice(0, 3)} needTags={needTags} onNewThread={onNewThread} />
      )}
    </div>
  );
}
