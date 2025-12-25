// apps/web/src/app/shrines/resolve/page.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function ResolvePage({ searchParams }: { searchParams: { place_id?: string } }) {
  const placeId = searchParams.place_id;
  if (!placeId) redirect("/search");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  // Next の BFF(/api/places/find) を叩く（中で Django にプロキシさせる想定）
  const res = await fetch(`${baseUrl}/api/places/find`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_id: placeId }),
    cache: "no-store",
  });

  if (!res.ok) redirect(`/search?keyword=${encodeURIComponent("神社")}`);

  const data = await res.json();
  const shrineId = data.shrine_id ?? data.id;
  if (!shrineId) redirect("/search");

  redirect(`/shrines/${shrineId}`);
}
