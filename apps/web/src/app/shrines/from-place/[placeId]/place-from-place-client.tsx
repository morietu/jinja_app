// apps/web/src/app/shrines/from-place/[placeId]/place-from-place-client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import { buildShrineClose } from "@/lib/navigation/shrineClose";
import { resolveShrineIdFromPlace } from "@/lib/api/shrineFromPlace";

type Props = { placeId: string; ctx?: "concierge" | "map" | null; tid?: string | null };

export default function PlaceFromPlaceClient({ placeId, ctx, tid }: Props) {
  const router = useRouter();
  const close = useMemo(() => buildShrineClose({ ctx: ctx ?? null, tid: tid ?? null }), [ctx, tid]);

  const [shrineId, setShrineId] = useState<number | null>(null);
  const [resolveState, setResolveState] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");

  const redirectedRef = useRef(false);

  // Google経路案内（place_id fallback だけでOK）
  const googleDirHref = useMemo(() => {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      placeId,
    )}&destination_place_id=${encodeURIComponent(placeId)}&travelmode=walking`;
  }, [placeId]);

  // 1) place_id -> shrine_id 解決
  useEffect(() => {
    let alive = true;

    (async () => {
      setResolveState("loading");
      setShrineId(null);

      try {
        const res = await resolveShrineIdFromPlace(placeId);
        if (!alive) return;

        if (res.status === "unauth") {
          setResolveState("unauth");
          return;
        }
        if (res.status === "error") {
          setResolveState("error");
          return;
        }

        setShrineId(res.shrineId);
        setResolveState("ok");
      } catch {
        if (!alive) return;
        setResolveState("error");
      }
    })();

    return () => {
      alive = false;
    };
  }, [placeId]);

  // 2) 解決できたら正規詳細へ合流（ctx/tid 引き継ぎ）
  useEffect(() => {
    if (redirectedRef.current) return;
    if (resolveState !== "ok" || shrineId == null) return;

    redirectedRef.current = true;

    const qs = new URLSearchParams();
    if (ctx) qs.set("ctx", ctx);
    if (tid) qs.set("tid", String(tid));

    const dest = qs.toString() ? `/shrines/${shrineId}?${qs.toString()}` : `/shrines/${shrineId}`;
    router.replace(dest);
  }, [resolveState, shrineId, ctx, tid, router]);

  const statusText =
    resolveState === "loading"
      ? "紐づけ（shrine_id）を確認中…"
      : resolveState === "ok"
        ? "神社詳細へ移動中…"
        : resolveState === "unauth"
          ? "ログインしていないため紐づけを解決できませんでした。Google経路案内のみ利用できます。"
          : resolveState === "error"
            ? "紐づけの解決に失敗しました（通信 or サーバー側）。Google経路案内のみ利用できます。"
            : null;

  return (
    <ShrineDetailShell
      title="神社の詳細"
      subtitle={null}
      close={close}
      addGoshuinHref={null}
      googleDirHref={googleDirHref}
      googleDirLabel="Googleマップで経路案内"
      saveAction={null}
      googleDirFallbackText="経路案内を準備できませんでした。"
    >
      {statusText ? (
        <div className="rounded-2xl border bg-white p-4 text-xs text-slate-600 shadow-sm">{statusText}</div>
      ) : (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
          神社情報を表示できませんでした。
        </div>
      )}
    </ShrineDetailShell>
  );
}
