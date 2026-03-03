import "server-only";
import type { Shrine } from "./types";
import { resolveServerBaseUrl } from "@/lib/server/resolveServerBaseUrl";

export async function getShrinePublicServer(id: number): Promise<Shrine> {
  const base = resolveServerBaseUrl();
  const url = `${base}/api/public/shrines/${id}/`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`getShrinePublicServer failed: ${res.status}`);
  return (await res.json()) as Shrine;
}
