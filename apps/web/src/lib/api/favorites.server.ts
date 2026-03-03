// apps/web/src/lib/api/favorites.server.ts
import "server-only";
import { headers } from "next/headers";
import type { Favorite } from "./favorites";
import { resolveServerBaseUrlFromHeaders } from "@/lib/server/resolveServerBaseUrl";

export async function getFavoritesServer(): Promise<Favorite[]> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const baseUrl = resolveServerBaseUrlFromHeaders(h);

  const r = await fetch(`${baseUrl}/api/favorites/`, {
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });

  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : (data?.results ?? []);
}
