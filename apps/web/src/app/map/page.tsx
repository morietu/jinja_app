// apps/web/src/app/map/page.tsx
import Link from "next/link";
import { getShrines } from "@/lib/api/shrines";
import ShrineMap from "@/components/map/ShrineMap";
import { ShortcutCard } from "@/components/ShortcutCard";
import { ShortcutCardGrid } from "@/components/ShortcutCardGrid";

export const metadata = {
  title: "Shrine Map",
  description: "Map preview",
};

export default async function MapPage() {
  const shrines = await getShrines();

  return (
    <main className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold mb-2">地図で見る</h1>

      <ShortcutCardGrid>
        <ShortcutCard href="/" title="トップに戻る" description="検索やランキングからも神社を探せます。" />
        <ShortcutCard
          href="/search"
          title="条件を指定して探す"
          description="エリアやご利益、キーワードで神社を絞り込み。"
        />
        <ShortcutCard
          href="/ranking"
          title="人気の神社を見る"
          description="多くの人が訪れている人気の神社をチェック。"
        />
      </ShortcutCardGrid>

      <div className="flex-1 space-y-3">
        {/* 地図（1つだけ） */}
        <div className="w-full h-[60vh] rounded-xl overflow-hidden">
          <ShrineMap shrines={shrines} />
        </div>

        {/* 一覧（スクロール付き） */}
        <div className="max-h-64 overflow-y-auto">
          <ul className="space-y-2 text-sm">
            {shrines.length === 0 && (
              <li className="text-xs text-gray-500">まだ位置情報付きの神社が登録されていません。</li>
            )}
            {shrines.map((s) => (
              <li key={s.id}>
                <Link href={`/shrines/${s.id}`} className="block border rounded p-2 cursor-pointer hover:bg-gray-50">
                  <div className="font-semibold">{s.name_jp}</div>
                  <div className="text-gray-600 text-xs">{s.address}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
