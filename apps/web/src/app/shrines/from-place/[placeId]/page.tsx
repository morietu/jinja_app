import PlaceFromPlaceClient from "./place-from-place-client";

type Props = {
  params: Promise<{ placeId: string }>;
  searchParams?: Promise<{ from?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { placeId } = await params;
  const sp = (searchParams ? await searchParams : undefined) ?? {};
  const from = sp.from ?? null;

  return <PlaceFromPlaceClient placeId={placeId} from={from} />;
}
