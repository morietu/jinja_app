// apps/web/src/lib/api/shrines.ts
import api from "./client";

export type Shrine = {
  id: number;
  name_jp: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance_m?: number;
};

export async function getShrines(): Promise<Shrine[]> {
  const res = await api.get("/shrines/");
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}

export async function getShrine(id: number): Promise<Shrine> {
  const res = await api.get(`/shrines/${id}/`);
  return res.data;
}

export async function fetchNearestShrines(
  lat: number,
  lng: number,
  radiusM = 2000
): Promise<Shrine[]> {
  const res = await api.get("/shrines/nearby/", {
    params: { lat, lng, radius_m: radiusM },
  });
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}

export { importFromPlace, type ImportResult } from "./favorites";
