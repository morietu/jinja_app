// apps/web/src/features/map/components/MapScreenLayout.tsx
"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import GoogleMap from "@/components/map/providers/GoogleMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import MapNearbyPicker from "@/features/map/components/MapNearbyPicker";
import { devLog } from "@/lib/client/logging";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";



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

type UrlSnap = {
  pathname: string;
  search: string;
  pick: string | null;
  returnTo: string | null;
  returnHash: string | null;
  place_id: string | null;
  shrine_id: string | null;
  tid: string | null;
};

// sp を受け取らず、spKey（= querystring）から再構築する
function makeSnapFromKey(spKey: string): UrlSnap {
  const params = new URLSearchParams(spKey);

  return {
    pathname: window.location.pathname,
    search: spKey ? `?${spKey}` : "",

    pick: params.get("pick"),
    returnTo: params.get("return"),
    returnHash: params.get("returnHash"),
    place_id: params.get("place_id"),
    shrine_id: params.get("shrine_id"),
    tid: params.get("tid"),
  };
}

type PickPayload = { placeId: string; lat?: number | null; lng?: number | null };

export default function MapScreenLayout({ initialSelect }: { initialSelect?: InitialSelect }) {
  const sp = useSearchParams();
  const spKey = sp.toString();

  const { coords } = useGeolocation({ roundDigits: 4, minMoveM: 50, minIntervalMs: 1000 });

  const [centerOverride, setCenterOverride] = useState<{ lat: number; lng: number } | null>(null);

  const center = useMemo(() => {
    if (centerOverride) return centerOverride;
    return coords ?? FALLBACK_CENTER;
  }, [coords, centerOverride]);

  const isWaitingCoords = coords == null && centerOverride == null;

  // =========================
  // ✅ Debug: remount 判定ログ
  // =========================
  const mountIdRef = useRef<string | null>(null);
  if (mountIdRef.current == null) {
    mountIdRef.current = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const lastSnapRef = useRef<UrlSnap | null>(null);

  useEffect(() => {
    const next = makeSnapFromKey(spKey);
    const prev = lastSnapRef.current;

    // 初回はprevがnullなので、初期化だけして必要ならログ
    if (!prev) {
      lastSnapRef.current = next;
      devLog("MapScreenLayout:INIT", { mountId: mountIdRef.current, snap: next });
      return;
    }

    // 変化点だけ出す（騒音削減）
    const changed =
      prev.pathname !== next.pathname ||
      prev.search !== next.search ||
      prev.pick !== next.pick ||
      prev.returnTo !== next.returnTo ||
      prev.returnHash !== next.returnHash ||
      prev.place_id !== next.place_id ||
      prev.shrine_id !== next.shrine_id ||
      prev.tid !== next.tid;

    if (changed) {
      devLog("MapScreenLayout:URL_CHANGED", {
        mountId: mountIdRef.current,
        prev,
        next,
      });
    }

    lastSnapRef.current = next;
  }, [spKey]);

  // =========================
  // 通常ロジック
  // =========================

  const pick = sp.get("pick");
  const isPickMode = pick === "goshuin";

  const tid = useMemo(() => new URLSearchParams(spKey).get("tid"), [spKey]);

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const qpPlaceId = sp.get("place_id");
  const qpShrineId = parseNum(sp.get("shrine_id"));
  const qpLat = parseNum(sp.get("lat"));
  const qpLng = parseNum(sp.get("lng"));
  const qpName = sp.get("name");
  const qpAddr = sp.get("addr");

  const ensureShrine = useCallback(async (placeId: string) => {
    const pid = (placeId ?? "").trim();
    if (!pid) throw new Error("resolve missing place_id");

    const r = await fetch("/api/places/resolve/", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ place_id: pid }),
    });

    if (r.status === 401 || r.status === 403) throw new Error("resolve unauth");
    if (!r.ok) throw new Error(`resolve failed: ${r.status}`);

    const data = await r.json().catch(() => null);

    const shrineId = Number(data?.shrine_id ?? data?.shrineId ?? data?.id ?? NaN);
    if (!Number.isFinite(shrineId) || shrineId <= 0) throw new Error("resolve no shrine");

    return { shrine_id: shrineId };
  }, []);


  const goPicked = useCallback(async () => {
    if (pick !== "goshuin") return;
    if (!selectedPlaceId) return;

    const { shrine_id } = await ensureShrine(selectedPlaceId);
    const href = buildShrineHref(shrine_id, { ctx: "map", tid });
    window.location.assign(href);
  }, [pick, selectedPlaceId, ensureShrine, tid]);

  // ✅ 選択の単一入口（選択 + 中心寄せ）
  const onPickPlace = useCallback((x: PickPayload) => {
    setSelectedPlaceId(x.placeId);

    const lat = x.lat ?? null;
    const lng = x.lng ?? null;
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      setCenterOverride({ lat, lng });
    }
  }, []);

  const loadByShrineId = useCallback(async (shrineId: number) => {
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

  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

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

    if (init.placeId) {
      onPickPlace({ placeId: init.placeId, lat: init.lat, lng: init.lng });
      return;
    }

    if (init.shrineId) {
      void loadByShrineId(init.shrineId);
      return;
    }

    if (typeof init.lat === "number" && typeof init.lng === "number") {
      setCenterOverride({ lat: init.lat, lng: init.lng });
    }
  }, [initialSelect, onPickPlace, loadByShrineId, qpAddr, qpLat, qpLng, qpName, qpPlaceId, qpShrineId]);

  const markers: { id: string; position: { lat: number; lng: number }; label?: string }[] = [];

  return (
    <div className="flex flex-col rounded-2xl border bg-white shadow-sm">
      <div className="relative z-0 h-[48vh] min-h-[260px] w-full overflow-hidden rounded-t-2xl border-b pointer-events-none">
        <GoogleMap center={center} zoom={13} markers={markers} className="h-full w-full" />

        {isWaitingCoords && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow">
            位置情報を取得中…
          </div>
        )}
      </div>

      <div className="flex flex-col">
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

        {isPickMode && (
          <p className="px-4 pb-2 text-[11px] text-slate-400">debug selectedPlaceId: {String(selectedPlaceId)}</p>
        )}

        <div className="relative z-20 px-2 pb-3 pointer-events-auto">
          <MapNearbyPicker
            limit={10}
            coords={coords}
            selectedPlaceId={selectedPlaceId}
            onSelect={onPickPlace}
            initialSelectedPlace={{
              place_id: qpPlaceId ?? initialSelect?.placeId ?? null,
              name: qpName ?? initialSelect?.name ?? null,
              address: qpAddr ?? initialSelect?.addr ?? null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
