import { apiPost } from "@/lib/api/http";

/** B: 特定/解決（place_id 直指定 or input+fields） */
export type PlaceFindPayload =
  | { place_id: string; language?: string; fields?: string }
  | { input: string; language?: string; fields?: string; locationbias?: string };

export async function findPlace(payload: PlaceFindPayload) {
  // POST で JSON ボディ（405 を防ぐ）
  return apiPost<any>("/places/find/", payload);
}

export type NearbyParams = { lat: number; lng: number; limit?: number };

export type NearbyShrine = {
  id: string;
  name: string;
  address?: string;
  distance_meters: number;
  duration_minutes?: number;
};

export async function getNearbyShrines({ lat, lng, limit = 20 }: NearbyParams) {
  const ctrl = new AbortController();
  const url = `/api/places/nearby?lat=${lat}&lng=${lng}&limit=${limit}`;
  const res = await fetch(url, { signal: ctrl.signal });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Failed: ${res.status}`);
  }
  const data: NearbyShrine[] = await res.json();
  return { data, abort: () => ctrl.abort() };
}
