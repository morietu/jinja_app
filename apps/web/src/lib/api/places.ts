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
  id: number;
  kind: "shrine" | "temple";
  name_jp: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distance: number; // meters
  distance_text?: string; // "368 m" など
  location?: { lat: number; lng: number };
  kyusei?: string | null;
};

export async function getNearbyShrines({ lat, lng, limit = 20 }: NearbyParams) {
  const ctrl = new AbortController();
  const url = `/api/shrines/nearby?lat=${lat}&lng=${lng}&limit=${limit}`;
  const res = await fetch(url, { signal: ctrl.signal });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Failed: ${res.status}`);
  }
  const data = (await res.json()) as NearbyShrine[];
  return { data, abort: () => ctrl.abort() };
}

export async function resolvePlace(place_id: string): Promise<{
  shrine_id: number;
  place_id: string;
  candidate_id?: number;
}> {
  const res = await apiPost<any>("/places/resolve/", { place_id }); // ← backend に合わせる
  return {
    shrine_id: Number(res.shrine_id ?? res.id),
    place_id: String(res.place_id ?? place_id),
    candidate_id: res.candidate_id ? Number(res.candidate_id) : undefined,
  };
}
