import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { serverLog } from "@/lib/server/logging";

type SP = {
  place_id?: string;
  locationbias?: string;
  ctx?: string;
  tid?: string;
};

export default async function ResolvePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const placeId = sp.place_id?.trim();
  if (!placeId) redirect("/?toast=resolve_missing_place");

  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";
  if (DEBUG) {
    serverLog("debug", "RESOLVE_COOKIE_HEADER", { cookieHeaderLen: cookieHeader.length });
  }

  // ✅ from-place ではなく places/resolve に寄せる
  const res = await fetch(`${baseUrl}/api/places/resolve/`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ place_id: placeId }),
  });

  if (res.status === 401) redirect("/?toast=login_required");
  if (!res.ok) redirect("/?toast=resolve_failed");

  // places/resolve は { shrine_id } を基本想定。念のため id fallback も残す。
  const data = (await res.json()) as { shrine_id?: number | string; id?: number | string };
  const shrineId = data.shrine_id ?? data.id;
  if (!shrineId) redirect("/?toast=resolve_no_shrine");

  const q = new URLSearchParams();
  if (sp.ctx) q.set("ctx", sp.ctx);
  if (sp.tid) q.set("tid", sp.tid);

  redirect(q.toString() ? `/shrines/${shrineId}?${q.toString()}` : `/shrines/${shrineId}`);
}
