// apps/web/src/lib/api/shrineFromPlace.ts
"use client";

import { fetchOnce } from "@/lib/api/inflight";

type Ok = { status: "ok"; shrineId: number };
type Unauth = { status: "unauth" };
type Err = { status: "error" };
export type ResolveShrineIdResult = Ok | Unauth | Err;

const cache = new Map<string, number>();

function parseShrineId(data: any): number | null {
  const sid = Number(data?.shrine_id ?? data?.shrineId ?? NaN);
  if (!Number.isFinite(sid) || sid <= 0) return null;
  return sid;
}

async function postFromPlace(pid: string): Promise<Response> {
  return fetch("/api/shrines/from-place", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({ place_id: pid }),
  });
}

export async function resolveShrineIdFromPlace(placeId: string): Promise<ResolveShrineIdResult> {
  const pid = (placeId ?? "").trim();
  if (!pid) return { status: "error" };

  const cached = cache.get(pid);
  if (cached) return { status: "ok", shrineId: cached };

  return fetchOnce(`POST:/api/shrines/from-place:${pid}`, async () => {
    try {
      const r = await postFromPlace(pid);

      if (r.status === 401 || r.status === 403) return { status: "unauth" as const };
      if (!r.ok) return { status: "error" as const };

      const data = await r.json().catch(() => null);
      const sid = parseShrineId(data);
      if (!sid) return { status: "error" as const };

      cache.set(pid, sid);
      return { status: "ok" as const, shrineId: sid };
    } catch {
      return { status: "error" as const };
    }
  });
}
