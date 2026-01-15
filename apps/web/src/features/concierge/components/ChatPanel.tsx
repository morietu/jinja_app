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
};



function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

type SheetSnap = "closed" | "peek" | "open";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * ✅ B案：BottomSheet（非embed専用）
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
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("closed");
  const [translateY, setTranslateY] = useState<number | null>(null);

  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);

  const movedRef = useRef(false);
  const TAP_SLOP = 6;

  const posRef = useRef({ openY: 0, peekY: 0, closedY: 0, maxY: 0 });

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

      const y = snap === "open" ? openY : snap === "peek" ? peekY : closedY;
      setTranslateY(y);
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [snap]);

  useEffect(() => {
    if (translateY === null && posRef.current.closedY > 0) {
      setTranslateY(posRef.current.closedY);
    }
  }, [translateY]);

  useEffect(() => {
    if (!recommendations.length) return;
    setMoreOpen(false);
    setSnap("closed");
    setTranslateY(posRef.current.closedY);
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

  useEffect(() => {
    if (recommendations.length <= 1) return;
    if (moreOpen) return;

    const rootEl = sheetScrollRef.current;
    const sentinel = sentinelRef.current;
    if (!rootEl || !sentinel) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setMoreOpen(true);
      },
      { root: rootEl, threshold: 0.01, rootMargin: "160px" },
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [recommendations.length, moreOpen]);

  const handleSheetScroll = () => {
    if (recommendations.length <= 1) return;
    if (moreOpen) return;
    const el = sheetScrollRef.current;
    if (!el) return;

    const remain = el.scrollHeight - (el.scrollTop + el.clientHeight);
    if (remain < 180) setMoreOpen(true);
  };

  if (translateY === null) return null;

  return (
    <div className="absolute inset-x-0 z-40 pointer-events-none" style={{ bottom: bottomOffset }}>
      {snap === "open" && (
        <button
          type="button"
          aria-label="close"
          className="absolute inset-0 bg-black/0 pointer-events-auto"
          onClick={() => snapTo("closed")}
        />
      )}

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
          <div
            className="px-3 pt-2 pb-2"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ touchAction: "none" }}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-neutral-300" />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-gray-700">今回のおすすめ</div>
            </div>
          </div>

          <div
            ref={sheetScrollRef}
            onScroll={handleSheetScroll}
            className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
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
  messages,
  loading = false,
  sending = false,
  error = null,
  onSend,
  canSend = true,
  recommendations = [],
  needTags = [],
  onNewThread,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, loading, sending]);

  useEffect(() => {
    const measure = () => {
      if (inputWrapRef.current) {
        setBottomOffset(inputWrapRef.current.offsetHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleSend = async (text: string) => {
    await onSend(text);
  };

  return (
    <div className="h-dvh bg-neutral-50">
      <div className="relative mx-auto flex h-dvh w-full max-w-sm flex-col overflow-hidden bg-white">
        {/* ① メッセージ */}
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
              <div className="mt-1.5 flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600">考え中…</div>
              </div>
            )}
          </div>

          <div className="h-1" />
        </div>

        {/* ② 入力欄 */}
        <div ref={inputWrapRef} className="relative z-50 border-t border-neutral-200 bg-white px-3 py-3">
          <div className="rounded-xl border border-neutral-300 focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-300 transition">
            <ChatInput disabled={sending || loading || !canSend} onSend={handleSend} error={error} />
          </div>
          {!canSend && (
            <p className="mt-2 text-xs text-slate-600">
              無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
            </p>
          )}
        </div>

        {/* ③ BottomSheet */}
        {recommendations.length > 0 && (
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
