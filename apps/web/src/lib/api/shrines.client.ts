import type { Shrine } from "./types";

export async function getShrinePublicClient(id: number): Promise<Shrine> {
  const url = `/api/public/shrines/${id}/`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`getShrinePublicClient failed: ${res.status}`);
  return (await res.json()) as Shrine;
}
