// apps/web/src/features/concierge/components/ChatPanel.tsx
"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ConciergeMessage, ConciergeRecommendation } from "@/lib/api/concierge";
import ChatInput from "./ChatInput";
import RecommendationUnit from "@/components/concierge/RecommendationUnit";

type Props = {
  messages: ConciergeMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  canSend: boolean;
  recommendations?: ConciergeRecommendation[];
  onNewThread?: () => void;
  needTags?: string[];
  embedMode?: boolean; // ✅ 追加（今はクラス調整に使うだけ）
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

type SheetSnap = "closed" | "peek" | "open";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * ✅ BottomSheet（非embed専用）
 * - closed: ハンドルだけ（カードは見せない）
 * - peek: 1枚目だけ見える
 * - open: 1〜3枚目を見える（2,3枚目は確実に出す）
 */
function RecsBottomSheet({
  recommendations,
  needTags,
  onNewThread,
  bottomOffset,
}: {
  recommendations: ConciergeRecommendation[];
  needTags: string[];
  onNewThread?: () => void;
  bottomOffset: number;
}) {
  const sheetScrollRef = useRef<HTMLDivElement | null>(null);
  const handleBarRef = useRef<HTMLDivElement | null>(null);

  const [snap, setSnap] = useState<SheetSnap>("closed");
  const [translateY, setTranslateY] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // closed時に見せる高さ（ハンドルだけ）
  const [closedVisiblePx, setClosedVisiblePx] = useState<number>(42);

  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);

  const movedRef = useRef(false);
  const TAP_SLOP = 6;

  const posRef = useRef({ openY: 0, peekY: 0, closedY: 0, maxY: 0 });

  // ✅ closedVisiblePx は「ハンドル高さ」から算出
  useEffect(() => {
    const update = () => {
      const handleH = Math.round(handleBarRef.current?.getBoundingClientRect().height ?? 0);
      setClosedVisiblePx(Math.max(34, handleH + 8));
    };

    update();
    const ro = new ResizeObserver(update);
    if (handleBarRef.current) ro.observe(handleBarRef.current);
    return () => ro.disconnect();
  }, [recommendations.length]);

  // ✅ snapごとのY計算
  useEffect(() => {
    const recalc = () => {
      const vh = window.innerHeight || 800;
      const sheetH = Math.round(vh * 0.72);
      const peekVisible = 170;
      const closedVisible = Math.min(sheetH - 16, closedVisiblePx);

      const openY = 0;
      const peekY = sheetH - peekVisible;
      const closedY = sheetH - closedVisible;

      posRef.current = { openY, peekY, closedY, maxY: closedY };

      const y = snap === "open" ? openY : snap === "peek" ? peekY : closedY;
      setTranslateY(y);
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [snap, closedVisiblePx]);

  // 初期化
  useEffect(() => {
    if (translateY === null && posRef.current.closedY > 0) {
      setTranslateY(posRef.current.closedY);
    }
  }, [translateY]);

  // recommendations更新時は閉じる
  useEffect(() => {
    if (!recommendations.length) return;
    setMoreOpen(false);
    setSnap("closed");
    setTranslateY(posRef.current.closedY);
    if (sheetScrollRef.current) sheetScrollRef.current.scrollTop = 0;
  }, [recommendations.length]);

  // ✅ A: peek/openになった瞬間に2,3件目を解放
  useEffect(() => {
    if (snap === "peek" || snap === "open") {
      setMoreOpen(true);
    } else {
      setMoreOpen(false);
    }
  }, [snap]);

  const snapTo = (next: SheetSnap) => {
    const { openY, peekY, closedY } = posRef.current;
    const y = next === "open" ? openY : next === "peek" ? peekY : closedY;
    setSnap(next);
    setTranslateY(y);

    if (next === "open" && sheetScrollRef.current) {
      sheetScrollRef.current.scrollTop = 0;
    }
  };

  const toggleSnap = () => {
    if (snap === "closed") snapTo("peek");
    else if (snap === "peek") snapTo("open");
    else snapTo("closed");
  };

  const decideSnapByThreshold = (y: number, closedY: number, peekY: number, openY: number): SheetSnap => {
    const midOpenPeek = (openY + peekY) / 2;
    const midPeekClosed = (peekY + closedY) / 2;
    if (y <= midOpenPeek) return "open";
    if (y <= midPeekClosed) return "peek";
    return "closed";
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

    if (!movedRef.current) {
      toggleSnap();
      return;
    }

    const { openY, peekY, closedY } = posRef.current;
    const currentY = translateY ?? closedY;
    const target = decideSnapByThreshold(currentY, closedY, peekY, openY);
    snapTo(target);
  };

  if (translateY === null) return null;

  const showCard1 = snap !== "closed";
  const showCard23 = moreOpen && recommendations.length > 1;

    return (
      <div className="absolute inset-x-0 z-40 pointer-events-none" style={{ bottom: bottomOffset }}>
        {/* open の時だけ背景タップで閉じる */}
        {snap === "open" && (
          <button
            type="button"
            aria-label="閉じる"
            className="absolute inset-0 bg-black/0 pointer-events-auto"
            onClick={() => snapTo("closed")}
          />
        )}

        {/* sheet 本体 */}
        <div className="pointer-events-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div
            className="flex flex-col rounded-t-2xl border border-neutral-200 bg-white shadow-sm"
            style={{
              height: "72vh",
              transform: `translateY(${translateY}px)`,
              transition: draggingRef.current ? "none" : "transform 180ms ease-out",
              willChange: "transform",
            }}
          >
            {/* handle（バーだけ） */}
            <div
              ref={handleBarRef}
              className="px-3 pt-2 pb-1 flex items-center justify-center"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ touchAction: "none" }}
            >
              <div className="h-1.5 w-10 rounded-full bg-neutral-300" />
            </div>

            {/* content */}
            <div
              ref={sheetScrollRef}
              className="flex-1 overflow-y-auto overscroll-contain pb-3"
              style={{ touchAction: "pan-y" }}
            >
              <div className="pt-2">
                <div className="px-3 space-y-2">
                  {showCard1 && (
                    <RecommendationUnit
                      key={recommendations[0]?.id ?? recommendations[0]?.place_id ?? 0}
                      rec={recommendations[0]}
                      index={0}
                      needTags={needTags}
                    />
                  )}

                  {showCard23 &&
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

                {showCard1 && (
                  <div className="mt-3 px-3">
                    <Link
                      href="/concierge/history"
                      className="block rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      onClick={onNewThread}
                    >
                      条件を追加して絞る（履歴へ）
                    </Link>
                  </div>
                )}

                <div className="h-8" />
              </div>
            </div>

            <div className="sr-only">{snap}</div>
          </div>
        </div>
      </div>
    );
}

export default function ChatPanel({
  messages,
  loading = false,
  sending = false,
  error = null,
  onSend,
  canSend = true,
  recommendations = [],
  needTags = [],
  onNewThread,
  embedMode = false,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const [bottomOffset, setBottomOffset] = useState(72);

  // ✅ input高さを ResizeObserver で追従
  useEffect(() => {
    const el = inputWrapRef.current;
    if (!el) return;

    const update = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) setBottomOffset(h);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ✅ メッセージ追加で下へ
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, loading, sending]);

  const handleSend = async (text: string) => {
    await onSend(text);
  };

  // ✅ AIメッセージを短く表示する関数
  const truncateAIMessage = (content: string, maxLength: number = 60) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  return (
    <div className={embedMode ? "w-full min-h-[400px]" : "h-full"}>
      {/* ✅ “箱”は1つ。ここに全部入れる */}
      <div className={`relative flex w-full flex-col overflow-hidden bg-white ${embedMode ? "min-h-[400px]" : "h-full"}`}>
        <div
          className={`relative mx-auto flex w-full max-w-sm flex-col overflow-hidden bg-white ${
            embedMode ? "min-h-[400px]" : "h-full"
          }`}
        >
          {/* ① メッセージ（ここだけスクロール） */}
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
            <div className="space-y-1.5">
              {messages.length === 0 && !loading && !sending && (
                <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
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
                const displayContent = m.role === "assistant" ? truncateAIMessage(m.content) : m.content;

                return (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%]">
                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl px-2.5 py-1.5 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "rounded-br-sm bg-emerald-600 text-white"
                            : "rounded-bl-sm bg-gray-100 text-gray-900"
                        }`}
                      >
                        {displayContent}
                      </div>
                      {m.role === "assistant" && m.content.length > 60 && (
                        <p className="mt-0.5 text-[10px] text-gray-400 text-left">詳細はカードをご確認ください</p>
                      )}
                      <p className={`mt-0.5 text-[10px] text-gray-400 ${m.role === "user" ? "text-right" : "text-left"}`}>
                        {timeLabel}
                      </p>
                    </div>
                  </div>
                );
              })}

              {(loading || sending) && (
                <div className="mt-1.5 flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600">考え中…</div>
                </div>
              )}
            </div>

            <div className="h-1" />
          </div>

          {/* ② 入力欄（常に下固定） */}
          <div ref={inputWrapRef} className="shrink-0 border-t border-neutral-200 bg-white px-3 py-3">
            <div className="rounded-xl border border-neutral-300 transition focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-300">
              <ChatInput disabled={sending || loading || !canSend} onSend={handleSend} error={error} />
            </div>

            {!canSend && (
              <p className="mt-2 text-xs text-slate-600">
                無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
              </p>
            )}
          </div>
        </div>

        {/* ③ BottomSheet */}
        {!embedMode && recommendations.length > 0 && (
          <RecsBottomSheet
            recommendations={recommendations.slice(0, 3)}
            needTags={needTags}
            onNewThread={onNewThread}
            bottomOffset={bottomOffset}
          />
        )}
      </div>
    </div>
  );
}
