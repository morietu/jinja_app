// apps/web/src/lib/api/shrines.server.ts
import "server-only";
import type { Shrine } from "./types";
import { resolveServerBaseUrl } from "@/lib/server/resolveServerBaseUrl";

export async function getShrinePublicServer(id: number): Promise<Shrine> {
  const base = await resolveServerBaseUrl();
  const url = `${base}/api/public/shrines/${id}/`;

  console.log("[getShrinePublicServer]", { id, base, url });

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "<failed to read body>");
    throw new Error(`getShrinePublicServer failed: ${res.status} body=${body.slice(0, 300)}`);
  }

  return (await res.json()) as Shrine;
}
