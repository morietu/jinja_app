// apps/web/src/app/shrines/from-place/[placeId]/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PlaceFromPlaceClient from "./place-from-place-client";

type Props = {
  params: Promise<{ placeId: string }>;
  searchParams?: Promise<{ ctx?: string; tid?: string }>;
};

async function resolveShrineId(placeId: string): Promise<number | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const cookie = h.get("cookie") ?? "";

  const r = await fetch(`${baseUrl}/api/shrines/from-place`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ place_id: placeId }),
  });

  if (!r.ok) return null;
  const data = (await r.json()) as { shrine_id?: number };
  const sid = Number(data?.shrine_id);
  return Number.isFinite(sid) ? sid : null;
}

export default async function Page({ params, searchParams }: Props) {
  const { placeId } = await params;
  const sp = (searchParams ? await searchParams : undefined) ?? {};
  const ctx = sp.ctx ?? null;
  const tid = sp.tid ?? null;

  const sid = await resolveShrineId(placeId);

  // ✅ 解決できたら即 redirect（ブリッジ画面を出さない＝フラッシュ消える）
  if (sid != null) {
    const q = new URLSearchParams();
    if (ctx) q.set("ctx", ctx);
    if (tid) q.set("tid", tid);
    redirect(q.toString() ? `/shrines/${sid}?${q.toString()}` : `/shrines/${sid}`);
  }

  // ✅ 解決できない時だけ client で表示（Google導線など）
  return <PlaceFromPlaceClient placeId={placeId} ctx={ctx} tid={tid} />;
}
