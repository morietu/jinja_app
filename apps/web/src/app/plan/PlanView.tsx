"use client";

import { useEffect, useState } from "react";

type InitialQuery = { q?: string; tab?: string; page?: number };

type Rec = {
  name?: string;
  display_name?: string;
  reason?: string;
  bullets?: string[];
  highlights?: string[];
  display_address?: string;
};

export default function PlanView({ initialQuery }: { initialQuery: InitialQuery }) {
  const [q, setQ] = useState(initialQuery.q ?? "");
  const [tab, setTab] = useState(initialQuery.tab ?? "overview");
  const [page, setPage] = useState(initialQuery.page ?? 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);

  const runSearch = async () => {
    const query = q.trim();
    if (!query) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/concierge/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = await res.json();
      const list = (json?.data?.recommendations ?? []) as Rec[];

      setRecs(Array.isArray(list) ? list : []);
    } catch {
      setError("通信に失敗しました");
      setRecs([]);
    } finally {
      setLoading(false);
    }
  };

  // 初回に q があれば自動検索（好みで）
  useEffect(() => {
    if ((initialQuery.q ?? "").trim()) void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primary = recs[0] ?? null;
  const title = primary?.display_name ?? primary?.name ?? "おすすめの神社";
  const reason = primary?.reason ?? "条件に合う候補から選びました。必要なら条件を追加できます。";
  const bullets = (
    primary?.bullets ??
    primary?.highlights ?? ["落ち着いて参拝しやすい", "混雑しにくい可能性", "雰囲気が希望に合う可能性"]
  ).slice(0, 3);

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">参拝プラン</h1>

      <div className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={() => setQ("")}
          placeholder="キーワード"
          className="border p-2 rounded w-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
        />
        <button className="px-3 py-2 rounded bg-slate-900 text-white text-sm" onClick={() => void runSearch()}>
          検索
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          className={`px-3 py-1 rounded ${tab === "overview" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => setTab("overview")}
        >
          概要
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "route" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => setTab("route")}
        >
          ルート
        </button>
      </div>

      <div className="mb-6">
        <button
          className="px-3 py-1 border rounded mr-2"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          前へ
        </button>
        <span className="text-sm">ページ: {page}</span>
        <button className="px-3 py-1 border rounded ml-2" onClick={() => setPage((p) => p + 1)}>
          次へ
        </button>
      </div>

      {loading && <div className="text-sm text-slate-600">読み込み中…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* ✅ A案：返答ではなく“評価理由”を固定ブロックで表示 */}
      {primary && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">今回のおすすめ（理由）</h2>
          <div className="mt-2 text-sm font-semibold">{title}</div>
          <div className="mt-1 text-sm text-slate-700">{reason}</div>

          <div className="mt-3 text-xs text-slate-500">［補足］</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ここに recs の一覧や地図などを追加していく */}
    </main>
  );
}
