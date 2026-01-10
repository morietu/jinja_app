// apps/web/src/app/shrines/from-place/[placeId]/page.tsx
import PlaceFromPlaceClient from "./place-from-place-client";

export default function Page({ params }: { params: { placeId: string } }) {
  const placeId = decodeURIComponent(params.placeId);
  return <PlaceFromPlaceClient placeId={placeId} />;
}
