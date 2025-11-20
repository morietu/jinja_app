
// apps/web/src/app/map/page.tsx
import { getShrines } from "@/lib/api/shrines";
// 他の import は既存どおり（Mapコンポーネントなど）

export default async function MapPage() {
  // API クライアント経由で一覧取得
  const shrines = await getShrines();

  return (
    <main className="p-4">
      {/* 実際はここで Map コンポーネントに props で渡す */}
      {/* <ShrineMap shrines={shrines} /> */}
      <pre className="text-xs bg-gray-100 p-2 rounded">
        {JSON.stringify(shrines, null, 2)}
      </pre>
    </main>
  );
}
