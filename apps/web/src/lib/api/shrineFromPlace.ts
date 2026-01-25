// apps/web/src/lib/api/shrineFromPlace.ts
export async function resolveShrineIdFromPlace(
  placeId: string,
): Promise<{ status: "ok"; shrineId: number } | { status: "unauth" } | { status: "error" }> {
  try {
    const r = await fetch("/api/shrines/from-place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ place_id: placeId }),
    });

    if (r.status === 401 || r.status === 403) return { status: "unauth" };
    if (!r.ok) return { status: "error" };

    const data = await r.json();
    const sid = Number(data?.shrine_id ?? NaN);
    if (!Number.isFinite(sid) || sid <= 0) return { status: "error" };

    return { status: "ok", shrineId: sid };
  } catch {
    return { status: "error" };
  }
}
