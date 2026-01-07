"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

// ✅ 押したときだけ読み込む（トップ初回を軽くする）
const ConciergeClient = dynamic(() => import("@/app/concierge/ConciergeClient"), {
  ssr: false,
  // 読み込み中の最低限UI（任意）
  loading: () => <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">読み込み中…</div>,
});

type Props = {
  className?: string;
  onToggle?: (open: boolean) => void;
};

export function HomeConciergeInlineClient({ className, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  const onOpen = () => {
    setOpen(true);
    onToggle?.(true);
  };

  const onClose = () => {
    setOpen(false);
    onToggle?.(false);
  };

  return (
    <div className={className}>
      {!open ? (
        <button type="button" onClick={onOpen} className="mt-6 w-full rounded-full bg-amber-500 py-3 text-sm font-semibold">
          今の気持ちから神社を探す
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">今の気持ちから神社を探す</p>
            <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:underline">
              閉じる
            </button>
          </div>
          <ConciergeClient />
        </div>
      )}
    </div>
  );
}

