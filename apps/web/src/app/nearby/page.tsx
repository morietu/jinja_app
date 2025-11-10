// apps/web/src/app/nearby/page.tsx
import NearbyClient from "./NearbyClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NearbyPage() {
  return <NearbyClient />;
}
