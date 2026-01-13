// apps/web/src/app/shrines/from-place/[placeId]/place-from-place-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { parseShrineBackContext, shrineBackConfig } from "@/lib/navigation/shrineBack";
import { useSearchParams } from "next/navigation";
import type { Shrine } from "@/lib/api/shrines";




type Props = { placeId: string; ctx?: string | null; tid?: string | null };

type PublicGoshuin = {
  id: number;
  shrine: number;
  shrine_name?: string | null;
  title?: string | null;
  is_public: boolean;
  likes: number;
  created_at: string;
  image_url?: string | null;
};

export default function PlaceFromPlaceClient({ placeId, ctx, tid }: Props) {
  const router = useRouter();

  const sp = useSearchParams();
  const bridge = sp.get("bridge") === "1";


  const back = shrineBackConfig(parseShrineBackContext(ctx));

  const [shrineId, setShrineId] = useState<number | null>(null);
  const [resolveState, setResolveState] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");

  const [publicGoshuins, setPublicGoshuins] = useState<PublicGoshuin[]>([]);
  const [loadingGoshuins, setLoadingGoshuins] = useState(false);
  const [routeMode, setRouteMode] = useState<"google" | "app">("app");

  const [shrine, setShrine] = useState<Shrine | null>(null);
  const [loadingShrine, setLoadingShrine] = useState(false);

  useEffect(() => {
    if (resolveState === "unauth" || resolveState === "error") {
      setRouteMode("google");
    }
  }, [resolveState]);

  // ★追加：解決できたらブリッジ終了（A案の肝）
  useEffect(() => {
    if (!bridge) return;
    if (resolveState !== "ok") return;
    if (shrineId == null) return;

    // ✅ クライアント遷移が既に走っている/URLが目的地っぽいなら何もしない（保険）
    // ここは厳密でなくてOK。二重replaceを抑えたい意図。
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      if (p.startsWith(`/shrines/${shrineId}`)) return;
    }

    const q = new URLSearchParams();
    if (ctx) q.set("ctx", ctx);
    if (tid) q.set("tid", tid);

    const dest = q.toString() ? `/shrines/${shrineId}?${q.toString()}` : `/shrines/${shrineId}`;
    router.replace(dest, { scroll: false });
  }, [bridge, resolveState, shrineId, router, ctx, tid]);

  const gmapsRouteLink = useMemo(() => {
    // destination は検索クエリっぽくして、destination_place_id に本命を入れる
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      placeId,
    )}&destination_place_id=${encodeURIComponent(placeId)}`;
  }, [placeId]);

  const internalMapHref = useMemo(() => {
    const q = new URLSearchParams();
    q.set("place_id", placeId);
    if (ctx) q.set("ctx", ctx);
    if (tid) q.set("tid", tid);
    return `/map?${q.toString()}`;
  }, [placeId, ctx, tid]);

  // --- 1) place_id -> shrine_id（ログインしていれば解決） ---
  useEffect(() => {
    let alive = true;

    (async () => {
      setResolveState("loading");

      try {
        const r = await fetch("/api/shrines/from-place", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ place_id: placeId }),
        });

        if (!alive) return;

        if (r.status === 401 || r.status === 403) {
          setResolveState("unauth");
          setShrineId(null);
        } else if (!r.ok) {
          setResolveState("error");
          setShrineId(null);
        } else {
          const data = (await r.json()) as { shrine_id: number };
          const sid = typeof data?.shrine_id === "number" ? data.shrine_id : Number(data?.shrine_id ?? NaN);

          if (!Number.isFinite(sid)) {
            setResolveState("error");
            setShrineId(null);
          } else {
            setShrineId(sid);
            setResolveState("ok");
          }
        }
      } catch {
        if (!alive) return;
        setResolveState("error");
        setShrineId(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [placeId]);

  // --- 2) shrine_id が取れたら public goshuins を引いて一致分だけ表示 ---
  // A案では「リダイレクトされる」ので基本ここは実行されない（残してもOK）
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingGoshuins(true);

      try {
        if (shrineId == null) {
          if (alive) setPublicGoshuins([]);
        } else {
          const r = await fetch(`/api/public/goshuins?limit=50&offset=0`, { cache: "no-store" });
          if (!r.ok) throw new Error("public goshuins failed");

          const json = await r.json();
          const results = (Array.isArray(json) ? json : (json?.results ?? [])) as PublicGoshuin[];

          if (alive) setPublicGoshuins(results);
        }
      } catch {
        if (alive) setPublicGoshuins([]);
      } finally {
        if (alive) setLoadingGoshuins(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [shrineId]);

  const matched = useMemo(() => {
    if (shrineId == null) return [];
    return publicGoshuins.filter((g) => g?.shrine === shrineId);
  }, [publicGoshuins, shrineId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (resolveState !== "ok" || shrineId == null) {
        if (alive) setShrine(null);
        return;
      }

      setLoadingShrine(true);
      try {
        const r = await fetch(`/api/shrines/${shrineId}`, { cache: "no-store" });
        if (!r.ok) throw new Error("shrine fetch failed");
        const data = (await r.json()) as Shrine;
        if (alive) setShrine(data);
      } catch {
        if (alive) setShrine(null);
      } finally {
        if (alive) setLoadingShrine(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [resolveState, shrineId]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h1 className="text-base font-semibold">神社の詳細</h1>
        <p className="mt-1 text-xs text-slate-500">place_id: {placeId}</p>

        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-slate-50 p-1 text-sm">
            <button
              type="button"
              onClick={() => setRouteMode("app")}
              className={`rounded-md px-3 py-2 ${
                routeMode === "app" ? "bg-white shadow-sm font-semibold" : "text-slate-600 hover:bg-white/60"
              }`}
            >
              アプリ内
            </button>
            <button
              type="button"
              onClick={() => setRouteMode("google")}
              className={`rounded-md px-3 py-2 ${
                routeMode === "google" ? "bg-white shadow-sm font-semibold" : "text-slate-600 hover:bg-white/60"
              }`}
            >
              Google
            </button>
          </div>

          {routeMode === "google" ? (
            <a
              href={gmapsRouteLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Googleマップでルートを見る
            </a>
          ) : (
            <Link
              href={internalMapHref}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              アプリ内マップで周辺を見る
            </Link>
          )}
        </div>

        <Link href={back.href} className="block text-center text-xs text-slate-500 hover:underline">
          {back.label}
        </Link>

        <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
          {resolveState === "loading" && "御朱印との紐づけ（shrine_id）を確認中…"}
          {resolveState === "ok" &&
            shrineId != null &&
            (bridge ? "神社詳細へ移動中…" : "紐づけ済み（神社情報を表示します）")}
          {resolveState === "unauth" && (
            <>ログインしていないため shrine_id を解決できませんでした。御朱印の表示・追加はログイン後に利用できます。</>
          )}
          {resolveState === "error" && "shrine_id の解決に失敗しました（通信 or サーバー側）。"}
        </div>

        {shrineId != null && (
          <div className="mt-3">
            <Link
              href={`/mypage?tab=goshuin&shrine=${shrineId}#goshuin-upload`}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              この神社で御朱印を追加
            </Link>
          </div>
        )}
      </div>

      {loadingShrine ? (
        <div className="mt-3 text-xs text-slate-500">神社情報を読み込み中…</div>
      ) : shrine ? (
        <div className="mt-3 rounded-xl border bg-white p-3">
          <div className="text-sm font-semibold">{shrine.name_jp}</div>
          {!!shrine.address && <div className="mt-1 text-xs text-slate-600">{shrine.address}</div>}
        </div>
      ) : null}

      {shrineId != null && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">御朱印一覧</h2>

          {loadingGoshuins ? (
            <div className="mt-2 text-xs text-slate-500">読み込み中…</div>
          ) : matched.length === 0 ? (
            <div className="mt-2 text-xs text-slate-500">この神社に紐づく公開御朱印はまだありません。</div>
          ) : (
            <div className="mt-3 space-y-3">
              {matched.map((g) => (
                <div key={g.id} className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">
                    #{g.id} / {g.created_at}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{g.title?.trim() || "（タイトルなし）"}</div>

                  {!!g.image_url && (
                    <Image
                      src={g.image_url}
                      alt={g.title ?? "goshuin"}
                      width={800}
                      height={600}
                      className="mt-2 w-full rounded-lg border"
                      style={{ height: "auto" }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
