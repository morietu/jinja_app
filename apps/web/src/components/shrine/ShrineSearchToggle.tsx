"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export function ShrineSearchToggle() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim().length === 0) return;
    router.push(`/map?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <div className="space-y-2">
      {/* 開閉ボタン */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm flex items-center justify-between"
      >
        <span className="text-gray-700">別の神社を探す</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {/* トグル表示される検索UI */}
      <div
        className={clsx(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <form onSubmit={handleSubmit} className="mt-2 space-y-2">
          <input
            type="text"
            placeholder="神社名・ご利益で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none"
          />
          <button type="submit" className="w-full rounded-xl bg-emerald-600 text-white py-2 text-sm">
            検索する
          </button>
        </form>
      </div>
    </div>
  );
}
