"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";


import type { Shrine } from "@/lib/api/shrines";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";
import { buildShrineClose } from "@/lib/navigation/shrineClose";
import { LABELS } from "@/lib/ui/labels";
import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import { resolveShrineIdFromPlace } from "@/lib/api/shrineFromPlace";



type Props = { placeId: string; ctx?: "concierge" | "map" | null; tid?: string | null };





export default function PlaceFromPlaceClient({ placeId, ctx, tid }: Props) {


  const close = useMemo(() => buildShrineClose({ ctx: ctx ?? null, tid: tid ?? null }), [ctx, tid]);

  const [shrineId, setShrineId] = useState<number | null>(null);
  const [resolveState, setResolveState] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");

  const [shrine, setShrine] = useState<Shrine | null>(null);
  const [loadingShrine, setLoadingShrine] = useState(false);

  const [publicGoshuins, setPublicGoshuins] = useState<PublicGoshuinItem[]>([]);
  const [loadingGoshuins, setLoadingGoshuins] = useState(false);

  useEffect(() => {
    setShrineId(null);
    setShrine(null);
    setPublicGoshuins([]);
    setResolveState("idle");
  }, [placeId]);

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

  // --- 2) shrine 情報取得（解決できたときだけ） ---
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

  // --- 3) 御朱印（公開） ---
  useEffect(() => {
    let alive = true;

    (async () => {
      if (shrineId == null) {
        if (alive) setPublicGoshuins([]);
        return;
      }

      setLoadingGoshuins(true);
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
      } finally {
        if (alive) setLoadingGoshuins(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [shrineId]);

  // --- 共通UIに流し込む値 ---

  const title = shrine?.name_jp ? shrine.name_jp : "神社の詳細";
  const subtitle = `place_id: ${placeId}`;

  // selfPath（このページ自身。戻り先の唯一の正解）
  // ctx/tid を含んだ「このページ自身」のURL（ログイン誘導の戻り先もこれ）
  const qs = new URLSearchParams();
  if (ctx) qs.set("ctx", ctx);
  if (tid) qs.set("tid", String(tid));

  const selfPath = `/shrines/from-place/${encodeURIComponent(placeId)}${qs.toString() ? `?${qs.toString()}` : ""}`;

  // ✅ 御朱印登録の入口は /shrines/[id] に統一するため、この画面では出さない
  const addGoshuinHref = null;

  // 保存ボタン（ログイン後も selfPath に戻す）
  const saveNode = shrineId != null ? <ShrineSaveButton shrineId={shrineId} nextPath={selfPath} /> : null;

  // 詳細ページ（確定ID）へ進む導線
  const detailHref =
    shrineId != null
      ? `/shrines/${shrineId}?${new URLSearchParams({
          ...(ctx ? { ctx } : {}),
          ...(tid ? { tid: String(tid) } : {}),
        }).toString()}`
      : null;
  // 保存ボタンも解決できたときだけ

  // 状況説明
  const statusText =
    resolveState === "loading"
      ? "紐づけ（shrine_id）を確認中…"
      : resolveState === "unauth"
        ? "ログインしていないため紐づけを解決できませんでした。Google経路案内のみ利用できます。"
        : resolveState === "error"
          ? "紐づけの解決に失敗しました（通信 or サーバー側）。Google経路案内のみ利用できます。"
          : shrineId != null
            ? "紐づけ済み（この場で詳細を表示します）"
            : null;

  const showFull = shrineId != null;

  return (
    <ShrineDetailShell
      title={title}
      subtitle={subtitle}
      close={close}
      addGoshuinHref={addGoshuinHref}
      saveAction={showFull && saveNode ? { shrineId: shrineId!, nextPath: selfPath, node: saveNode } : null}
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
              {loadingGoshuins ? (
                <div className="mt-2 text-xs text-slate-500">読み込み中…</div>
              ) : (
                <PublicGoshuinSection
                  items={publicGoshuins}
                  addGoshuinHref={null}
                  sendingLabel="この神社の公開分のみ"
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </ShrineDetailShell>
  );
}
