// apps/web/src/app/shrines/from-place/[placeId]/place-from-place-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import type { Shrine } from "@/lib/api/shrines";

import { buildShrineDetailModel } from "@/lib/shrine/buildShrineDetailModel";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import ShrineDetailArticle from "@/components/shrine/detail/ShrineDetailArticle";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";

import { buildShrineClose } from "@/lib/navigation/shrineClose";
import { resolveShrineIdFromPlace } from "@/lib/api/shrineFromPlace";

type Props = { placeId: string; ctx?: "concierge" | "map" | null; tid?: string | null };

export default function PlaceFromPlaceClient({ placeId, ctx, tid }: Props) {
  const close = useMemo(() => buildShrineClose({ ctx: ctx ?? null, tid: tid ?? null }), [ctx, tid]);

  const [shrineId, setShrineId] = useState<number | null>(null);
  const [resolveState, setResolveState] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");

  const [shrine, setShrine] = useState<Shrine | null>(null);
  const [loadingShrine, setLoadingShrine] = useState(false);

  const [publicGoshuins, setPublicGoshuins] = useState<PublicGoshuinItem[]>([]);

  useEffect(() => {
    setShrineId(null);
    setShrine(null);
    setPublicGoshuins([]);
    setResolveState("idle");
  }, [placeId]);

  // Google経路案内（座標優先 → place_id fallback）
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

  // --- 1) place_id -> shrine_id ---
  useEffect(() => {
    let alive = true;

    (async () => {
      setResolveState("loading");

      const res = await resolveShrineIdFromPlace(placeId);
      if (!alive) return;

      if (res.status === "unauth") {
        setResolveState("unauth");
        setShrineId(null);
        return;
      }
      if (res.status === "error") {
        setResolveState("error");
        setShrineId(null);
        return;
      }

      setShrineId(res.shrineId);
      setResolveState("ok");
    })();

    return () => {
      alive = false;
    };
  }, [placeId]);

  // --- 2) shrine 情報 ---
  useEffect(() => {
    let alive = true;

    (async () => {
      if (shrineId == null) {
        setShrine(null);
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
  }, [shrineId]);

  // --- 3) 公開御朱印 ---
  useEffect(() => {
    let alive = true;

    (async () => {
      if (resolveState !== "ok" || shrineId == null) {
        if (alive) setPublicGoshuins([]);
        return;
      }

      try {
        const r = await fetch(`/api/public/goshuins?limit=50&offset=0&shrine=${shrineId}`, { cache: "no-store" });
        if (!r.ok) throw new Error("public goshuins failed");

        const json = await r.json();
        const results = (Array.isArray(json) ? json : (json?.results ?? [])) as any[];

        if (alive) {
          setPublicGoshuins(
            results
              .map((g) => ({
                id: Number(g.id),
                title: g.title ?? null,
                created_at: g.created_at,
                image_url: g.image_url ?? null,
              }))
              .filter((g) => Number.isFinite(g.id)),
          );
        }
      } catch {
        if (alive) setPublicGoshuins([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [resolveState, shrineId]);

  // ctx/tid 付き selfPath（保存/ログイン導線の戻り先）
  const qs = new URLSearchParams();
  if (ctx) qs.set("ctx", ctx);
  if (tid) qs.set("tid", String(tid));
  const selfPath = `/shrines/from-place/${encodeURIComponent(placeId)}${qs.toString() ? `?${qs.toString()}` : ""}`;

  // ✅ “確定してる状態”
  const showFull = resolveState === "ok" && shrineId != null && shrine != null;

  const title = (shrine?.name_jp ?? "").trim() || "神社の詳細";

  // ✅ production UI からデバッグ subtitle を消す
  const subtitle = null;

  // ✅ from-place では「御朱印追加」導線を出さない（/shrines/[id] に寄せる）
  const addGoshuinHref = null;

  const model =
    showFull && shrine
      ? buildShrineDetailModel({
          shrine,
          publicGoshuins,
          conciergeBreakdown: null,
        })
      : null;

  const saveNode = showFull ? <ShrineSaveButton shrineId={shrineId!} nextPath={selfPath} /> : null;

  const statusText =
    resolveState === "loading"
      ? "紐づけ（shrine_id）を確認中…"
      : resolveState === "unauth"
        ? "ログインしていないため紐づけを解決できませんでした。Google経路案内のみ利用できます。"
        : resolveState === "error"
          ? "紐づけの解決に失敗しました（通信 or サーバー側）。Google経路案内のみ利用できます。"
          : null;

  return (
    <ShrineDetailShell
      title={title}
      subtitle={subtitle}
      close={close}
      addGoshuinHref={addGoshuinHref}
      googleDirHref={googleDirHref}
      googleDirLabel="Googleマップで経路案内"
      saveAction={
        showFull && saveNode
          ? {
              shrineId: shrineId!,
              nextPath: selfPath,
              node: saveNode,
            }
          : null
      }
      googleDirFallbackText="経路案内を準備できませんでした。"
    >
      {statusText ? (
        <div className="rounded-2xl border bg-white p-4 text-xs text-slate-600 shadow-sm">{statusText}</div>
      ) : null}

      {model ? (
        <ShrineDetailArticle {...model} addGoshuinHref={null} />
      ) : (
        !statusText && (
          <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
            神社情報を表示できませんでした。
          </div>
        )
      )}
    </ShrineDetailShell>
  );
}
