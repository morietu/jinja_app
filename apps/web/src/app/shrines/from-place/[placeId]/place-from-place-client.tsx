"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { Shrine } from "@/lib/api/shrines";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";
import { buildShrineClose } from "@/lib/navigation/shrineClose";
import { LABELS } from "@/lib/ui/labels";



type Props = { placeId: string; ctx?: "concierge" | "map" | null; tid?: string | null };

type PublicGoshuin = {
  id: number;
  shrine: number;
  title?: string | null;
  is_public: boolean;
  likes: number;
  created_at: string;
  image_url?: string | null;
};



export default function PlaceFromPlaceClient({ placeId, ctx, tid }: Props) {
  const sp = useSearchParams();
  const urlTid = sp.get("tid");
  const tidEffective = tid ?? urlTid;

  const close = useMemo(() => buildShrineClose({ ctx: ctx ?? null, tid: tidEffective ?? null }), [ctx, tidEffective]);

  const [shrineId, setShrineId] = useState<number | null>(null);
  const [resolveState, setResolveState] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");

  const [shrine, setShrine] = useState<Shrine | null>(null);
  const [loadingShrine, setLoadingShrine] = useState(false);

  const [publicGoshuins, setPublicGoshuins] = useState<PublicGoshuin[]>([]);
  const [loadingGoshuins, setLoadingGoshuins] = useState(false);

  // Google経路案内は一本化：
  // - shrine座標があれば座標優先（/shrines/:id と一致）
  // - なければ place_id にフォールバック
  const googleDirHref = useMemo(() => {
    const latNum = Number((shrine as any)?.lat ?? (shrine as any)?.latitude ?? NaN);
    const lngNum = Number((shrine as any)?.lng ?? (shrine as any)?.longitude ?? NaN);
    const hasLocation =
      Number.isFinite(latNum) &&
      Number.isFinite(lngNum) &&
      latNum >= -90 &&
      latNum <= 90 &&
      lngNum >= -180 &&
      lngNum <= 180;

    if (hasLocation) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${latNum},${lngNum}`,
      )}&travelmode=walking`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      placeId,
    )}&destination_place_id=${encodeURIComponent(placeId)}&travelmode=walking`;
  }, [placeId, shrine]);

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
          return;
        }
        if (!r.ok) {
          setResolveState("error");
          setShrineId(null);
          return;
        }

        const data = (await r.json()) as { shrine_id: number };
        const sid = typeof data?.shrine_id === "number" ? data.shrine_id : Number(data?.shrine_id ?? NaN);

        if (!Number.isFinite(sid) || sid <= 0) {
          setResolveState("error");
          setShrineId(null);
          return;
        }

        setShrineId(sid);
        setResolveState("ok");
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

  // --- 2) shrine 情報取得（解決できたときだけ） ---
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

  // --- 3) 御朱印（公開） ---
  useEffect(() => {
    let alive = true;

    (async () => {
      if (resolveState !== "ok" || shrineId == null) {
        if (alive) setPublicGoshuins([]);
        return;
      }

      setLoadingGoshuins(true);
      try {
        const r = await fetch(`/api/public/goshuins?limit=50&offset=0`, { cache: "no-store" });
        if (!r.ok) throw new Error("public goshuins failed");
        const json = await r.json();
        const results = (Array.isArray(json) ? json : (json?.results ?? [])) as PublicGoshuin[];
        if (alive) setPublicGoshuins(results);
      } catch {
        if (alive) setPublicGoshuins([]);
      } finally {
        if (alive) setLoadingGoshuins(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [resolveState, shrineId]);

  const matched = useMemo(() => {
    if (shrineId == null) return [];
    return publicGoshuins.filter((g) => g?.shrine === shrineId);
  }, [publicGoshuins, shrineId]);

  // --- 共通UIに流し込む値 ---
  const title = shrine?.name_jp ? shrine.name_jp : "神社の詳細";
  const subtitle = `place_id: ${placeId}`;

  // 御朱印追加は「解決できたときだけ」
  const addGoshuinHref =
    resolveState === "ok" && shrineId != null ? `/mypage?tab=goshuin&shrine=${shrineId}#goshuin-upload` : null;

  // 詳細を見る（確定IDへ）も解決できたときだけ
  const detailHref =
    resolveState === "ok" && shrineId != null
      ? `/shrines/${shrineId}?${new URLSearchParams({
          ...(ctx ? { ctx } : {}),
          ...(tidEffective ? { tid: String(tidEffective) } : {}),
        }).toString()}`
      : null;

  // 保存ボタンも解決できたときだけ
  const saveNode =
    resolveState === "ok" && shrineId != null ? (
      <ShrineSaveButton shrineId={shrineId} nextPath={`/shrines/${shrineId}`} />
    ) : null;

  // 状況説明
  const statusText =
    resolveState === "loading"
      ? "紐づけ（shrine_id）を確認中…"
      : resolveState === "ok"
        ? "紐づけ済み（この場で詳細を表示します）"
        : resolveState === "unauth"
          ? "ログインしていないため紐づけを解決できませんでした。Google経路案内のみ利用できます。"
          : resolveState === "error"
            ? "紐づけの解決に失敗しました（通信 or サーバー側）。Google経路案内のみ利用できます。"
            : null;

  const showFull = resolveState === "ok" && shrineId != null;

    return (
      <ShrineDetailShell
        title={title}
        subtitle={subtitle}
        close={close}
        addGoshuinHref={addGoshuinHref}
        saveAction={
          showFull && saveNode ? { shrineId: shrineId!, nextPath: `/shrines/${shrineId}`, node: saveNode } : null
        }
        googleDirHref={googleDirHref}
        googleDirLabel="Googleマップで経路案内"
        googleDirFallbackText="経路案内を準備できませんでした。"
      >
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          {statusText ? <div className="text-xs text-slate-600">{statusText}</div> : null}

          {loadingShrine ? <div className="mt-2 text-xs text-slate-500">神社情報を読み込み中…</div> : null}

          {showFull && shrine ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-sm font-semibold">{shrine.name_jp}</div>
                {!!shrine.address && <div className="mt-1 text-xs text-slate-600">{shrine.address}</div>}
              </div>

              {detailHref ? (
                <Link
                  href={detailHref}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  {LABELS.shrineDetail} {/* ✅ 置換 */}
                </Link>
              ) : null}

              <div className="rounded-xl border bg-white p-3">
                <div className="text-sm font-semibold">公開御朱印</div>

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
            </div>
          ) : null}
        </div>
      </ShrineDetailShell>
    );
}
