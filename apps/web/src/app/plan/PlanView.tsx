"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchConciergePlan,
  ConciergePlanError,
  type ConciergePlanRec,
  type ConciergePlanStop,
} from "@/api/conciergePlan";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const abortName = "AbortError";

type InitialQuery = { q?: string; tab?: string; page?: number };

export default function PlanView({ initialQuery }: { initialQuery: InitialQuery }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [pathname, searchParams]);

  const [q, setQ] = useState(initialQuery.q ?? "");
  const [tab, setTab] = useState(initialQuery.tab ?? "overview");
  const [page, setPage] = useState(initialQuery.page ?? 1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<ConciergePlanRec[]>([]);
  const [stops, setStops] = useState<ConciergePlanStop[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const setSP = useCallback(
    (patch: Record<string, string | number | null | undefined>, opts?: { replace?: boolean }) => {
      const sp = new URLSearchParams(searchParams?.toString());

      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") sp.delete(k);
        else sp.set(k, String(v));
      }

      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      if (opts?.replace ?? true) router.replace(url);
      else router.push(url);
    },
    [router, pathname, searchParams],
  );

  // URL -> state（戻る/共有/リロードで state が追従する）
  useEffect(() => {
    const q0 = searchParams.get("q") ?? "";
    const tab0 = searchParams.get("tab") ?? "overview";
    const page0Raw = Number(searchParams.get("page") ?? "1");
    const page0 = Number.isFinite(page0Raw) && page0Raw > 0 ? page0Raw : 1;

    if (q0 !== q) setQ(q0);
    if (tab0 !== tab) setTab(tab0);
    if (page0 !== page) setPage(page0);
  }, [searchParams, q, tab, page]);

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (!query) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const json = await fetchConciergePlan({ query }, { signal: ctrl.signal });

      const list = (json?.data?.recommendations ?? []) as ConciergePlanRec[];
      const nextRecs = Array.isArray(list) ? list : [];
      setRecs(nextRecs);

      const st = (json?.stops ?? []) as ConciergePlanStop[];
      const nextStops = Array.isArray(st) ? st : [];
      setStops(nextStops);

      // 検索成功したら page=1 に戻す（state + URL）
      setPage(1);
      setSP({ q: query, tab, page: 1 }, { replace: false }); // 検索は履歴に残すなら push相当

      if (tab === "route" && nextStops.length === 0) {
        setTab("overview");
        setSP({ tab: "overview" });
      }
    } catch (e: any) {
      if (e?.name === abortName) return;

      if (e instanceof ConciergePlanError) setError(e.message);
      else setError(e?.message ?? "通信に失敗しました");

      setRecs([]);
      setStops([]);
      setPage(1);
      setSP({ page: 1 });

      if (tab === "route") {
        setTab("overview");
        setSP({ tab: "overview" });
      }
    } finally {
      setLoading(false);
    }
  }, [q, tab, setSP]);

  // 初回：URLにqがあるなら検索（initialQueryはSSRからの初期注入用）
  useEffect(() => {
    if ((initialQuery.q ?? "").trim()) void runSearch();
    return () => abortRef.current?.abort();
  }, [initialQuery.q, runSearch]);

  const primary = recs[0] ?? null;

  const title = primary?.display_name ?? primary?.name ?? "おすすめの神社";
  const reason = primary?.reason ?? "条件に合う候補から選びました。必要なら条件を追加できます。";
  const bullets = (
    primary?.bullets ??
    primary?.highlights ?? ["落ち着いて参拝しやすい", "混雑しにくい可能性", "雰囲気が希望に合う可能性"]
  ).slice(0, 3);

  const PAGE_SIZE = 5;
  const maxPage = Math.max(1, Math.ceil(recs.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), maxPage);
  const pagedRecs = recs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const goTab = (nextTab: string) => {
    setTab(nextTab);
    setSP({ tab: nextTab });
  };

  const prevPage = () => {
    const next = Math.max(1, safePage - 1);
    setPage(next);
    setSP({ page: next });
  };

  const nextPageFn = () => {
    const next = Math.min(maxPage, safePage + 1);
    setPage(next);
    setSP({ page: next });
  };

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">参拝プラン</h1>

      <div className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="キーワード"
          className="border p-2 rounded w-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
        />
        <button
          className="px-3 py-2 rounded bg-slate-900 text-white text-sm disabled:opacity-60"
          onClick={() => void runSearch()}
          disabled={loading}
        >
          検索
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          className={`px-3 py-1 rounded ${tab === "overview" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => goTab("overview")}
        >
          概要
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "route" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => goTab("route")}
          disabled={!stops.length}
          title={!stops.length ? "ルート情報がありません" : ""}
        >
          ルート
        </button>
      </div>

      {loading && <div className="text-sm text-slate-600">読み込み中…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {tab === "overview" && primary && (
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

      {tab === "route" && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">ルート</h2>
          {!stops.length ? (
            <div className="mt-2 text-sm text-slate-600">ルート情報がありません</div>
          ) : (
            <ol className="mt-3 space-y-3">
              {stops.map((s) => (
                <li key={s.order} className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">
                    {s.order}. {s.name}
                  </div>
                  <div className="text-xs text-slate-600">{s.display_address}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    移動 {s.travel_minutes}分 / 滞在 {s.stay_minutes}分 / 到着目安 {s.eta_minutes}分
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {tab === "overview" && recs.length > 0 && (
        <>
          {/* ページUIはここだけ。二重にしない。 */}
          <div className="mt-4 mb-2 flex items-center gap-2">
            <button
              className="px-3 py-1 border rounded disabled:opacity-60"
              onClick={prevPage}
              disabled={safePage <= 1}
            >
              前へ
            </button>
            <span className="text-sm">
              ページ: {safePage} / {maxPage}
            </span>
            <button
              className="px-3 py-1 border rounded disabled:opacity-60"
              onClick={nextPageFn}
              disabled={safePage >= maxPage}
            >
              次へ
            </button>
          </div>

          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">候補</h2>
            <ol className="mt-3 space-y-2">
              {pagedRecs.map((r, i) => (
                <li key={`${r.name ?? "rec"}-${i}`} className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">{r.display_name ?? r.name ?? "名称未設定"}</div>
                  {r.display_address && <div className="text-xs text-slate-600">{r.display_address}</div>}
                  {r.reason && <div className="mt-1 text-xs text-slate-700">{r.reason}</div>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
