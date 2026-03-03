import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { resolveServerBaseUrlFromHeaders } from "@/lib/server/resolveServerBaseUrl";

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
  const baseUrl = resolveServerBaseUrlFromHeaders(h);

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

  const data = (await res.json()) as { shrine_id?: number | string; id?: number | string };
  const shrineId = data.shrine_id ?? data.id;
  if (!shrineId) redirect("/?toast=resolve_no_shrine");

  const q = new URLSearchParams();
  const ctx = sp.ctx?.trim();
  if (ctx) q.set("ctx", ctx);
  const tid = sp.tid?.trim();
  if (tid) q.set("tid", tid);

  const query = Object.fromEntries(q.entries());
  redirect(buildShrineHref(shrineId, { query: Object.keys(query).length ? query : undefined }));
}
