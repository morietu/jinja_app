"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { trackNearbyFetch } from "@/lib/analytics/searchEvents";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";
import { requestCurrentPosition } from "@/lib/geo/currentPosition";
import { buildGoogleMapsDirUrl, buildGoogleMapsSearchUrl } from "@/lib/maps/googleMaps";
import { buildMapDetailHref } from "@/lib/nav/buildMapDetailHref";

import Link from "next/link";

const FALLBACK = { lat: 35.681236, lng: 139.767125 }; // 東京駅
const DEFAULT_LIMIT = 10;

type NearbyState = "idle" | "loading" | "error" | "empty" | "ready";
type NearbyFetchTrigger = "auto" | "manual_refresh";
type NearbyItemView = PlacesNearbyResponse["results"][number] & {
  detailHref?: string | null;
};

const DEBUG = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_LOG === "1";

function dedupeKey(p: any) {
  const sid = p?.shrine_id ?? null;
  const pid = p?.place_id ?? null;
  if (pid) return `place:${pid}`;
  if (sid) return `shrine:${sid}`;
  // fallbackは “idx混ぜると毎回変わってデバッグ不能” なので注意
  return `fallback:${p?.name ?? ""}:${p?.lat ?? ""},${p?.lng ?? ""}:${p?.address ?? ""}`;
}

function logDedupe(label: string, arr: any[]) {
  if (!DEBUG) return;
  const keys = arr.map((p) => dedupeKey(p));
  const unique = new Set(keys);
  clientLog(label, { total: keys.length, unique: unique.size, dup: keys.length - unique.size });
}

function clientLog(event: string, payload?: Record<string, unknown>) {
  if (!DEBUG) return;
  console.log(`[map] ${event}`, payload ?? {});
}

export default function NearbyShrineCardListClient() {
  const sp = useSearchParams();
  const tid = sp.get("tid");
  const submitted = sp.get("submitted");
  const submissionStatus = sp.get("status");
  const submittedShrineName = sp.get("name")?.trim() ?? "";
  const showSubmissionPendingBanner = submitted === "1" && submissionStatus === "pending";

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  const [items, setItems] = useState<NearbyItemView[]>([]);
  const [state, setState] = useState<NearbyState>("idle");
  const [err, setErr] = useState<string | null>(null);

  const lastKeyRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const usedFallbackRef = useRef(false);

  // 位置情報取得 — coarse fix is enough for "nearby shrines" and far more
  // reliable on mobile than a high-accuracy GPS acquisition (RH3-4b). On any
  // failure we keep the existing FALLBACK (東京駅) behaviour.
  useEffect(() => {
    let cancelled = false;
    setLoadingLoc(true);

    void requestCurrentPosition().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        clientLog("LOC_OK", { acc: result.accuracy });
        usedFallbackRef.current = false;
        setCoords({ lat: result.lat, lng: result.lng });
        setUsedFallback(false);
      } else {
        clientLog("LOC_FAILED", { reason: result.reason });
        usedFallbackRef.current = true;
        setCoords(FALLBACK);
        setUsedFallback(true);
      }
      setLoadingLoc(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchNearby = useCallback(
    async (lat: number, lng: number, trigger: NearbyFetchTrigger = "auto") => {
      // ✅ state を依存に入れると setState(loading) で関数が再生成され、
      // 呼び出し側の useEffect が再発火するリスクがあるため、state は依存から外します。
      const key = `${lat},${lng},${DEFAULT_LIMIT},${tid ?? ""}`;
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setErr(null);
      setState("loading");

      try {
        const qs = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          limit: String(DEFAULT_LIMIT),
        });

        trackNearbyFetch({
          source: "map",
          surface: "web",
          trigger,
          used_fallback: usedFallbackRef.current,
        });

        const r = await fetch(`/api/places/nearby?${qs.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        });

        if (!r.ok) {
          setErr(`status=${r.status}`);
          setItems([]);
          setState("error");
          return;
        }

        const data = (await r.json()) as PlacesNearbyResponse;
        const results = Array.isArray(data?.results) ? data.results : [];

        // ✅ ここで一括で View Model 化
        const viewItems: NearbyItemView[] = results.map((p) => ({
          ...p,
          detailHref: buildMapDetailHref({
            shrineId: (p as any).shrine_id ?? null,
            placeId: p.place_id ?? null,
            tid,
          }),
        }));

        setItems(viewItems);
        setState(viewItems.length === 0 ? "empty" : "ready");
        clientLog("NEARBY_OK", { count: viewItems.length });
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : "Fetch error");
        setItems([]);
        setState("error");
      }
    },
    [tid],
  );

  useEffect(() => {
    if (!coords) return;
    fetchNearby(coords.lat, coords.lng);
    return () => abortRef.current?.abort();
  }, [coords, fetchNearby]);

  useEffect(() => {
    logDedupe("NEARBY_RENDER_ITEMS", items);
  }, [items]);

  // UI Helper
  const title = loadingLoc ? "位置情報を取得中…" : "近くの神社";
  const canAction = !!coords && state !== "loading";

  const googleSearchNearbyUrl = useMemo(() => {
    const base = usedFallback ? "東京駅 周辺 神社" : "周辺 神社";
    return buildGoogleMapsSearchUrl(base);
  }, [usedFallback]);

  return (
    <div className="flex flex-col gap-6">
      {/* デバッグ用表示：必要なら残す */}
      {DEBUG && (
        <div className="text-[10px] text-[var(--kt-color-text-secondary)]">
          state={state} | items={items.length}
        </div>
      )}

      {showSubmissionPendingBanner && (
        <div
          className="whitespace-pre-line rounded-3xl border border-emerald-200/60 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-900"
          role="status"
          aria-live="polite"
        >
          {submittedShrineName
            ? `「${submittedShrineName}」の投稿を受け付けました。\n現在審査中のため、公開検索にはまだ表示されません。\n審査完了後に公開されます。`
            : "投稿を受け付けました。\n現在審査中のため、公開検索にはまだ表示されません。\n審査完了後に公開されます。"}
        </div>
      )}

      {usedFallback && !loadingLoc && (
        <div className="rounded-2xl border border-[var(--kt-color-border-default)]/50 bg-[var(--kt-color-surface-default)]/70 px-4 py-3 text-[11px] text-[var(--kt-color-text-secondary)]">
          現在地が取れないため仮の場所（東京駅）で検索中
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--kt-color-text-secondary)]">{title}</p>
        <button
          type="button"
          onClick={() => {
            if (!coords) return;
            lastKeyRef.current = ""; // ✅ 更新ボタンだけ強制リフレッシュ
            void fetchNearby(coords.lat, coords.lng, "manual_refresh");
          }}
          className="rounded-full border border-[var(--kt-color-border-default)]/70 bg-[var(--kt-color-surface-default)]/80 px-3 py-1 text-[11px] font-medium text-[var(--kt-color-text-primary)] hover:bg-[var(--kt-color-surface-default)] disabled:opacity-50"
          disabled={!canAction}
        >
          {state === "loading" ? "更新中…" : "更新"}
        </button>
      </div>

      {/* エラー表示 */}
      {err && (
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 text-xs text-rose-700">
          取得に失敗しました: {err}
        </div>
      )}

      {/* ローディング・スケルトン風 */}
      {state === "loading" && items.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-[var(--kt-color-surface-elevated)]" />
          ))}
        </div>
      )}

      {/* 空・エラー時のフォールバック */}
      {(state === "empty" || state === "error") && (
        <div className="space-y-4 rounded-3xl border border-[var(--kt-color-border-default)]/25 bg-[var(--kt-color-surface-default)]/70 p-5 text-center">
          <div className="space-y-1">
            <p className="text-sm text-[var(--kt-color-text-secondary)]">
              {state === "error" ? "情報の取得に失敗しました。" : "近くに候補が見つかりませんでした。"}
            </p>
            {state === "empty" && (
              <p className="text-xs text-[var(--kt-color-text-secondary)]">この場所にはまだ登録がない可能性があります。</p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {state === "empty" && (
              <Link
                href="/shrines/new?returnTo=/map"
                className="inline-flex flex-1 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                神社を追加する
              </Link>
            )}

            <a
              className="flex-1 rounded-full border border-[var(--kt-color-border-default)]/70 bg-[var(--kt-color-surface-default)] px-3 py-2 text-center text-xs font-medium text-[var(--kt-color-text-primary)] hover:bg-[var(--kt-color-surface-elevated)]"
              href={googleSearchNearbyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Googleマップで探す
            </a>
          </div>
        </div>
      )}

      {/* リスト表示 */}
      {state !== "loading" && items.length > 0 ? (
        <ul className="space-y-8">
          {items.map((p, idx) => {
            const shrineId = (p as any).shrine_id ?? null;

            const key =
              p.place_id ??
              (shrineId ? `shrine:${shrineId}` : `fallback:${p.name}:${p.lat ?? ""},${p.lng ?? ""}:${p.address ?? ""}`);

            return (
              <li
                key={key}
                className={[
                  "rounded-3xl border border-[var(--kt-color-border-default)]/25 bg-[var(--kt-color-surface-default)]/70 px-5",
                  idx % 2 === 0 ? "mr-3 py-6 sm:mr-8" : "ml-3 py-8 sm:ml-10",
                ].join(" ")}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--kt-color-text-primary)]">{p.name}</p>
                  {p.address ? <p className="text-xs text-[var(--kt-color-text-secondary)]">{p.address}</p> : null}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  {p.detailHref ? (
                    <Link
                      className="rounded-full border border-[var(--kt-color-border-default)]/55 bg-[var(--kt-color-surface-default)]/80 px-3 py-1.5 text-center text-xs font-normal text-[var(--kt-color-text-primary)] hover:bg-[var(--kt-color-surface-elevated)]"
                      href={p.detailHref}
                      prefetch={false}
                    >
                      詳細を見る
                    </Link>
                  ) : (
                    <a
                      className="rounded-full border border-[var(--kt-color-border-default)]/55 bg-[var(--kt-color-surface-default)]/75 px-3 py-1.5 text-center text-xs font-normal text-[var(--kt-color-text-primary)] hover:bg-[var(--kt-color-surface-default)]"
                      href={buildGoogleMapsSearchUrl(p.name, p.address ?? undefined)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Googleマップで見る
                    </a>
                  )}

                  <a
                    className="rounded-full border border-emerald-200/55 bg-emerald-50/80 px-3 py-1.5 text-center text-xs font-normal text-emerald-900 hover:bg-emerald-100"
                    href={buildGoogleMapsDirUrl({
                      lat: p.lat ?? undefined,
                      lng: p.lng ?? undefined,
                      address: p.address ?? undefined,
                      fallbackName: p.name,
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    経路案内
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
