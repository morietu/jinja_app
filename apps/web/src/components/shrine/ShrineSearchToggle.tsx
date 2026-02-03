"use client";

import { useState } from "react";
import clsx from "clsx";

export function ShrineSearchToggle() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm flex items-center justify-between"
      >
        <span className="text-gray-700">別の神社を探す</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      <div
        className={clsx(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <form action="/map" method="GET" className="mt-2 space-y-2">
          <input
            name="q"
            type="text"
            placeholder="神社名・ご利益で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 text-white py-2 text-sm"
            disabled={keyword.trim().length === 0}
          >
            検索する
          </button>
        </form>
      </div>
    </div>
  );
}
