"use client";

import React from "react";

type Props = {
  username: string;
  count: number;
  limit: number;
  offset: number;
};

export default function PublicGoshuinHeader({ username, count, limit, offset }: Props) {
  const from = count ? Math.min(offset + 1, count) : 0;
  const to = count ? Math.min(offset + limit, count) : 0;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/g/${encodeURIComponent(username)}` : "";

  const onCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    // トーストが無ければ最小はこれでOK
    alert("URLをコピーしました");
  };

  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">@{username} の御朱印帳</h1>
        <p className="mt-1 text-xs text-slate-500">公開されている御朱印のみ表示します。</p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="text-xs text-slate-500">{count ? `${from}-${to} / ${count}` : ""}</div>

        <button
          type="button"
          onClick={onCopy}
          className="rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          URLをコピー
        </button>
      </div>
    </header>
  );
}
