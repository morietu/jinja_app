"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useConciergeSearch } from "@/hooks/useConciergeSearch";
import ConciergeShrineCard from "@/components/shrine/ConciergeShrineCard";

const EXAMPLES = [
  "転職が不安。背中を押してほしい。",
  "最近疲れていて、落ち着ける神社がいい。",
  "金運を上げたい。行動のきっかけがほしい。",
];

export default function ConciergeClientSimple() {
  const router = useRouter();
  const [text, setText] = useState("");

  const { items, loading, error, remainingFree, limit, reply, search, clear } = useConciergeSearch();

  const submit = useCallback(
    async (value: string) => {
      await search(value);
    },
    [search],
  );

  const reset = useCallback(() => {
    setText("");
    clear();
  }, [clear]);

  const isLimitReached = remainingFree === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <section className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">神社コンシェルジュ</h1>
            <p className="text-sm text-slate-600">今の気分や願いごとから、相性のよい神社候補を整理して提案します。</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="concierge-text" className="text-sm font-semibold text-slate-800">
                  相談内容
                </label>

                <textarea
                  id="concierge-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="今の気分・願い・状況を、そのまま書いてください"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                  onClick={() => submit(text)}
                >
                  {loading ? "選定中…" : "神社を提案して"}
                </button>

                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                  onClick={reset}
                >
                  クリア
                </button>
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">提案結果</h2>
              <p className="text-sm text-slate-600">条件と相性をもとに、参拝先の候補を整理しています。</p>
            </div>
          </div>

          {typeof remainingFree === "number" && typeof limit === "number" && remainingFree > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              あと {remainingFree} 回までは無料で試せます
            </div>
          )}

          {isLimitReached && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold">無料で利用できる回数を使い切りました。</p>
              {reply ? <p className="mt-1">{reply}</p> : null}
              <p className="mt-1 text-xs text-rose-700/90">
                有料プランでは、引き続き相性に合う神社の提案を利用できます。
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => router.push("/map")}
                >
                  地図で近くの神社を見る
                </button>

                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  onClick={() => router.push("/billing/upgrade")}
                >
                  有料プランを見る
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3">
              {items.map(({ id, cardProps, tid }, idx) => {
                console.log("[ConciergeClientSimple] card", {
                  id,
                  tid,
                  shrineId: cardProps.shrineId,
                  title: cardProps.title,
                });

                return <ConciergeShrineCard key={id} {...cardProps} tid={tid ?? null} hideLeftMark={idx !== 0} />;
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
