"use client";

import { useState } from "react";
import { useConciergeSearch } from "@/hooks/useConciergeSearch";
import { ShrineList } from "@/components/shrines/ShrineList";

const EXAMPLES = [
  "転職が不安。背中を押してほしい。",
  "最近疲れていて、落ち着ける神社がいい。",
  "金運を上げたい。行動のきっかけがほしい。",
];

export default function ConciergeClientSimple() {
  const [text, setText] = useState("");
  const { items, loading, error, submit, reset } = useConciergeSearch();

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-xl font-bold">神社コンシェルジュ</h1>

      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full rounded-xl border p-3 text-sm"
          placeholder="今の気分・願い・状況をそのまま書いてください"
        />

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={loading}
            onClick={() => submit(text)}
          >
            {loading ? "選定中…" : "神社を提案して"}
          </button>

          <button
            type="button"
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            disabled={loading}
            onClick={() => {
              setText("");
              reset();
            }}
          >
            クリア
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              disabled={loading}
              onClick={() => {
                setText(e);
                submit(e);
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-xl border p-3 text-sm text-rose-600">{error}</div> : null}
      </div>

      <ShrineList items={items} variant="list" emptyText="まだ結果がありません" />
    </main>
  );
}
