// apps/web/src/lib/api/favorites.server.ts
import { headers } from "next/headers";
import type { Favorite } from "./favorites";

export async function getFavoritesServer(): Promise<Favorite[]> {
  const h = await headers();

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const cookie = h.get("cookie") ?? "";

  const r = await fetch(`${baseUrl}/api/favorites/`, {
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });

  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : (data?.results ?? []);
}
