const BASE = process.env.EXPO_PUBLIC_API_BASE!;
if (!BASE) throw new Error("EXPO_PUBLIC_API_BASE is not set");

type Json = Record<string, unknown>;

async function j<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${r.statusText} ${txt}`);
  }
  return r.json() as Promise<T>;
}

export type Shrine = {
  id: number;
  name_jp?: string | null;
  name_romaji?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const api = {
  popular: (limit = 10, near?: { lat: number; lng: number; radius_km: number }) => {
    const u = new URL(`${BASE}/shrines/popular/`);
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("format", "json");
    if (near) {
      u.searchParams.set("near", `${near.lat},${near.lng}`);
      u.searchParams.set("radius_km", String(near.radius_km));
    }
    return j<Shrine[]>(fetch(u.toString()));
  },
  shrine: (id: number) => j<Shrine>(fetch(`${BASE}/shrines/${id}/?format=json`)),
  conciergePlan: (body: { lat: number; lng: number; benefit?: string; mode?: "walk" | "drive"; time_limit?: string }) =>
    j<Json>(fetch(`${BASE}/concierge/plan/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })),
};
