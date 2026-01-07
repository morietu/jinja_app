// apps/web/src/features/home/components/HomeConciergeInlineClient.tsx
"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const ConciergeClient = dynamic(() => import("@/app/concierge/ConciergeClient"), {
  ssr: false,
  loading: () => <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">読み込み中…</div>,
});

type Props = {
  className?: string;
  onToggle?: (open: boolean) => void;
  defaultOpen?: boolean;
};

export function HomeConciergeInlineClient({ className, onToggle, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const topRef = useRef<HTMLDivElement | null>(null);

  const onOpen = () => {
    setOpen(true);
    onToggle?.(true);

    // 任意：開いた瞬間に先頭へ寄せる（ワンクッション無し版）
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const onClose = () => {
    setOpen(false);
    onToggle?.(false);
  };

  return (
    <div className={className}>
      <div ref={topRef} />

      {!open ? (
        <button
          type="button"
          onClick={onOpen}
          className="w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          今の気持ちから神社を探す
        </button>
      ) : (
        <div className="relative space-y-3">
          {/* 上部：開始直後の安心用（残す） */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">今の気持ちから神社を探す</p>
            <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:underline">
              閉じる
            </button>
          </div>

          <ConciergeClient />

          {/* 下部固定：チャット後も必ず閉じられる */}
          <div className="sticky bottom-0 -mx-4 mt-4 border-t bg-slate-50/90 px-4 py-3 backdrop-blur">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full border bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
