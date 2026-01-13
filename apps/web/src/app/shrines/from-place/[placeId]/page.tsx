// apps/web/src/app/shrines/from-place/[placeId]/page.tsx
import PlaceFromPlaceClient from "./place-from-place-client";

type Props = {
  params: Promise<{ placeId: string }>;
  searchParams?: Promise<{ ctx?: string; tid?: string }>;
};

function normalizeCtx(v?: string | null): "map" | "concierge" | null {
  return v === "map" || v === "concierge" ? v : null;
}

export default async function Page({ params, searchParams }: Props) {
  const { placeId } = await params;
  const sp = (await searchParams) ?? {};
  const ctx = normalizeCtx(sp.ctx ?? null);
  const tid = sp.tid ?? null;

  return <PlaceFromPlaceClient placeId={placeId} ctx={ctx} tid={tid} />;
}
