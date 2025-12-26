// apps/web/src/app/shrines/resolve/page.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";

type SP = { place_id?: string; locationbias?: string };

export default async function ResolvePage({
  searchParams,
}: {
  searchParams: Promise<SP>; // ★ここがポイント
}) {
  const sp = await searchParams; // ★await する
  const placeId = sp.place_id;

  if (!placeId) redirect("/?toast=resolve_missing_place"); // or "/search"

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/places/find`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_id: placeId }),
    cache: "no-store",
  });

  if (!res.ok) redirect("/?toast=resolve_failed");

  const data = await res.json();
  const shrineId = data.shrine_id ?? data.id;
  if (!shrineId) redirect("/?toast=resolve_no_shrine");

  redirect(`/shrines/${shrineId}`);
}
