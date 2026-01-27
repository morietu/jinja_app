// apps/web/src/features/home/components/HomeConciergeInlineClient.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

const ConciergeClient = dynamic(() => import("@/app/concierge/ConciergeClient"), {
  ssr: false,
  loading: () => <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">読み込み中…</div>,
});

type Props = {
  className?: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function HomeConciergeInlineClient({ className, open, onOpen, onClose }: Props) {
  const topRef = useRef<HTMLDivElement | null>(null);

  // ✅ closeイベント受けたら確実に閉じる（親へ委譲）
  useEffect(() => {
    const onCloseEvt = () => {
   
      onClose();
    };
    window.addEventListener("jinja:close-concierge", onCloseEvt);
    return () => window.removeEventListener("jinja:close-concierge", onCloseEvt);
  }, [onClose]);

  const handleOpen = () => {
    onOpen();

    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.dispatchEvent(new Event("concierge:focus-input"));
    });
  };

  return (
    <div className={className}>
      <div ref={topRef} />

      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          今の気持ちから神社を探す
        </button>
      ) : (
        <div className="relative">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">今の気持ちから神社を探す</p>
              <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">
                閉じる
              </button>
            </div>

            <ConciergeClient embedMode />
          </div>
        </div>
      )}
    </div>
  );
}
