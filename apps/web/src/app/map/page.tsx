// apps/web/src/app/map/page.tsx
import { getShrines, type Shrine } from "@/lib/api/shrines";
import ShrineMap from "@/components/map/ShrineMap";

export default async function MapPage() {
  // サーバーコンポーネント側で API から一覧取得
  const shrines: Shrine[] = await getShrines();

  return (
    <main className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold mb-2">地図で見る</h1>
      {/* 実際の地図は ShrineMap 側に任せる */}
      <ShrineMap shrines={shrines} />
    </main>
  );
}
