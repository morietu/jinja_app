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
    <main className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold mb-2">地図で見る</h1>
      <div className="space-y-3">
        <ShrineMap shrines={shrines} />

        {/* 一覧（タップでも詳細行けるようにしておく） */}
        <ul className="space-y-2 text-sm">
          {shrines.map((s) => (
            <li key={s.id} className="border rounded p-2 cursor-pointer hover:bg-gray-50">
              <div className="font-semibold">{s.name_jp}</div>
              <div className="text-gray-600 text-xs">{s.address}</div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
