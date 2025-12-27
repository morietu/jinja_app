import { redirect } from "next/navigation";
import { headers } from "next/headers";

type SP = { place_id?: string; locationbias?: string };

export default async function ResolvePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const placeId = sp.place_id;
  if (!placeId) redirect("/?toast=resolve_missing_place");

  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  // ★これが肝：ユーザーの cookie を “そのまま” BFF に転送
  console.log("[resolve] cookieHeader len =", cookieHeader.length);

  const res = await fetch(`${baseUrl}/api/shrines/from-place/`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ place_id: placeId }),
  });

  if (res.status === 401) redirect("/?toast=login_required"); // 例
  if (!res.ok) redirect("/?toast=resolve_failed");

  const data = (await res.json()) as { shrine_id?: string; id?: string };
  const shrineId = data.shrine_id ?? data.id;
  if (!shrineId) redirect("/?toast=resolve_no_shrine");

  redirect(`/shrines/${shrineId}`);
}
