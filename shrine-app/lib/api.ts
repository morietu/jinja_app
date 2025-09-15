// shrine-app/lib/api.ts

// ---- Base URL（末尾スラッシュ除去）----
const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE; // 例: http://127.0.0.1:8000/api
export const API_BASE = (RAW_BASE ?? "").replace(/\/+$/, "");
if (!API_BASE) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE is not set. Put it in shrine-app/.env (e.g. http://127.0.0.1:8000/api)"
  );
}

// ---- fetch helper（タイムアウト付き）----
type FetchOpts = RequestInit & { timeoutMs?: number };

async function j<T>(input: RequestInfo | URL, init: FetchOpts = {}): Promise<T> {
  const { timeoutMs = 10000, headers, ...rest } = init;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...rest,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      signal: ac.signal,
    });
    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch {}
      throw new Error(`HTTP ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(to);
  }
}

function url(path: string, params?: Record<string, string>) {
  const u = new URL(`${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u;
}

// ---- Types ----
export type Shrine = {
  id: number;
  name_jp?: string | null;
  name_romaji?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ConciergePlanRequest = {
  lat: number;
  lng: number;
  benefit?: string;
  mode?: "walk" | "drive";
  time_limit?: string; // "2h" など
};

export type ConciergePlace = {
  name: string;
  area_hint?: string;
  reason?: string;
  place_id?: string;
  address?: string;
  photo_url?: string;
  location?: { lat: number; lng: number };
};

export type ConciergePlanResponse = {
  mode: string;
  main: ConciergePlace;
  nearby: ConciergePlace[];
};

// ---- API ----
export const api = {
  // /api/shrines/popular/?limit=..&near=lat,lng&radius_km=..&format=json
  popular(limit = 10, near?: { lat: number; lng: number; radius_km: number }) {
    const params: Record<string, string> = {
      format: "json",
      limit: String(Math.max(1, Math.min(50, limit))),
    };
    if (near) {
      params.near = `${near.lat},${near.lng}`;
      params.radius_km = String(near.radius_km);
    }
    return j<Shrine[]>(url("/shrines/popular/", params));
  },

  // /api/shrines/:id/?format=json
  shrine(id: number | string) {
    return j<Shrine>(url(`/shrines/${id}/`, { format: "json" }));
  },

  // POST /api/concierge/plan/
  conciergePlan(body: ConciergePlanRequest) {
    return j<ConciergePlanResponse>(url("/concierge/plan/"), {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // /api/ ルートの疎通確認
  ping() {
    return j<Record<string, string>>(url("/"));
  },
};

// 既存コードの互換ショートカット
export const getPopularShrines = (limit = 20) => api.popular(limit);
export const getShrineDetail  = (id: number | string) => api.shrine(id);

export default api;
