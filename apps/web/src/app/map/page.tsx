// apps/web/src/app/map/page.tsx
import { getShrines } from "@/lib/api/shrines";
import ShrineMap from "@/components/map/ShrineMap";

export const metadata = {
  title: "Shrine Map",
  description: "Map preview",
};

export default async function MapPage() {
  const shrines = await getShrines();

  return (
    <main className="max-w-5xl mx-auto px-4 pt-4 pb-2 h-[calc(100vh-56px)] flex flex-col space-y-3">
      <h1 className="text-xl font-bold">地図で見る</h1>
      <div className="flex-1">
        <ShrineMap shrines={shrines} />
      </div>
    </main>
  );
}
