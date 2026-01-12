import PlaceFromPlaceClient from "./place-from-place-client";

type Props = {
  params: Promise<{ placeId: string }>;
  searchParams?: Promise<{ ctx?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { placeId } = await params;
  const sp = (searchParams ? await searchParams : undefined) ?? {};
  const ctx = sp.ctx ?? null;

  return <PlaceFromPlaceClient placeId={placeId} ctx={ctx} />;
}
