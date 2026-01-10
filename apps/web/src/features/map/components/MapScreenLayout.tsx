// apps/web/src/features/map/components/MapScreenLayout.tsx
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import GoogleMap from "@/components/map/providers/GoogleMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import MapNearbyPicker from "@/features/map/components/MapNearbyPicker";

export type InitialSelect = {
  shrineId: number | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  name: string | null;
  addr: string | null;
};

const FALLBACK_CENTER = { lat: 35.681236, lng: 139.767125 };

function parseNum(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function MapScreenLayout({ initialSelect }: { initialSelect?: InitialSelect }) {
  const router = useRouter();
  const sp = useSearchParams();

  const pick = sp.get("pick"); // "goshuin" のときだけ戻る
  const isPickMode = pick === "goshuin";

  const returnTo = sp.get("return");
  const returnHash = sp.get("returnHash");

  const { coords } = useGeolocation();

  // ✅ 初期選択がある場合は center を優先する（1回だけ）
  const [centerOverride, setCenterOverride] = useState<{ lat: number; lng: number } | null>(null);

  const center = useMemo(() => {
    if (centerOverride) return centerOverride;
    return coords ?? FALLBACK_CENTER;
  }, [coords, centerOverride]);

  // ✅ 選択状態（place_idがMapのキー）
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // ✅ /map?place_id=... でも開けるように（ConciergeCardから渡す）
  const qpPlaceId = sp.get("place_id");
  const qpShrineId = parseNum(sp.get("shrine_id"));
  const qpLat = parseNum(sp.get("lat"));
  const qpLng = parseNum(sp.get("lng"));
  const qpName = sp.get("name");
  const qpAddr = sp.get("addr");

  const ensureShrine = useCallback(async (placeId: string) => {
    const r = await fetch("/api/shrines/from-place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId }),
    });
    if (!r.ok) throw new Error("from-place failed");
    return (await r.json()) as { shrine_id: number };
  }, []);

  const goPicked = useCallback(async () => {
    if (pick !== "goshuin") return;
    if (!selectedPlaceId) return;

    const { shrine_id } = await ensureShrine(selectedPlaceId);

    const base = returnTo ? decodeURIComponent(returnTo) : "/mypage?tab=goshuin";
    const sep = base.includes("?") ? "&" : "?";
    const withShrine = `${base}${sep}shrine=${shrine_id}`;
    const hash = returnHash ? `#${returnHash}` : "";

    router.push(`${withShrine}${hash}`);
  }, [pick, selectedPlaceId, ensureShrine, router, returnTo, returnHash]);

  // -----------------------------------------
  // ✅ 初期選択処理（place_id優先、なければshrine_id）
  // -----------------------------------------

  const loadByPlaceId = useCallback((placeId: string, fallback?: { lat?: number | null; lng?: number | null }) => {
    setSelectedPlaceId(placeId);

    const lat = fallback?.lat ?? null;
    const lng = fallback?.lng ?? null;
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      setCenterOverride({ lat, lng });
    }
  }, []);

  const loadByShrineId = useCallback(async (shrineId: number) => {
    // ✅ 既存の /api/shrines/[id] を利用（BFF）
    const r = await fetch(`/api/shrines/${shrineId}`, { cache: "no-store" });
    if (!r.ok) return;

    const s = (await r.json()) as any;

    const rawPlaceId = s?.place_id ?? s?.placeId ?? s?.google_place_id ?? null;
    const placeId = rawPlaceId != null ? String(rawPlaceId) : null;

    const latRaw = s?.lat ?? s?.location?.lat ?? null;
    const lngRaw = s?.lng ?? s?.location?.lng ?? null;

    const lat = typeof latRaw === "number" ? latRaw : typeof latRaw === "string" ? Number(latRaw) : null;
    const lng = typeof lngRaw === "number" ? lngRaw : typeof lngRaw === "string" ? Number(lngRaw) : null;

    if (placeId) setSelectedPlaceId(placeId);
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      setCenterOverride({ lat, lng });
    }
  }, []);

  // ✅ initialSelect or URL query を「初回だけ」反映
  useEffect(() => {
    // 優先順位：props(initialSelect) > URL query
    const init: InitialSelect | null =
      initialSelect ??
      (qpPlaceId || qpShrineId || (qpLat != null && qpLng != null)
        ? {
            shrineId: qpShrineId ?? null,
            placeId: qpPlaceId ?? null,
            lat: qpLat ?? null,
            lng: qpLng ?? null,
            name: qpName ?? null,
            addr: qpAddr ?? null,
          }
        : null);

    if (!init) return;

    // 1) placeId があれば即選択＆センター寄せ
    if (init.placeId) {
      loadByPlaceId(init.placeId, { lat: init.lat, lng: init.lng });
      return;
    }

    // 2) shrineId があれば詳細から placeId を引く
    if (init.shrineId) {
      void loadByShrineId(init.shrineId);
      return;
    }

    // 3) lat/lng だけでもセンター寄せ
    if (typeof init.lat === "number" && typeof init.lng === "number") {
      setCenterOverride({ lat: init.lat, lng: init.lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers（最小は空でOK。必要なら「選択中」をマーカー化できる）
  const markers: { id: string; position: { lat: number; lng: number }; label?: string }[] = [];

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="h-1/2 min-h-[220px] border-b">
        <GoogleMap center={center} zoom={13} markers={markers} className="h-full w-full" />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <p className="text-xs font-semibold text-gray-700">{isPickMode ? "神社を選択" : "近くの神社"}</p>

            {isPickMode && (
              <button
                type="button"
                onClick={goPicked}
                disabled={!selectedPlaceId}
                className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                この神社で続ける
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {/* ✅ 「2枚目状態」：選択済み情報を最上段に固定表示させるためのデータ */}
            <MapNearbyPicker
              limit={10}
              selectedPlaceId={selectedPlaceId}
              onSelectPlaceId={setSelectedPlaceId}
              initialSelectedPlace={{
                place_id: qpPlaceId ?? initialSelect?.placeId ?? null,
                name: qpName ?? initialSelect?.name ?? null,
                address: qpAddr ?? initialSelect?.addr ?? null,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
