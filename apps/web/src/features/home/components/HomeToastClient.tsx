// apps/web/src/features/home/components/HomeToastClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Toast = { msg: string; kind: "error" | "info" };

export function HomeToastClient() {
  const shownRef = useRef(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("toast");
    if (!t) return;
    if (shownRef.current) return;
    shownRef.current = true;

    const msg =
      t === "resolve_failed"
        ? "神社の特定に失敗しました。もう一度お試しください。"
        : t === "resolve_no_shrine"
          ? "神社情報が見つかりませんでした。"
          : t === "resolve_missing_place"
            ? "リンクが不完全でした。"
            : "処理に失敗しました。";

    setToast({ msg, kind: "error" });

    // クエリだけ削除（戻るで再表示されない）
    const u = new URL(window.location.href);
    u.searchParams.delete("toast");
    window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-3 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow">
        {toast.msg}
        <button type="button" onClick={() => setToast(null)} className="ml-3 text-xs text-red-700 underline">
          閉じる
        </button>
      </div>
    </div>
  );
}
