// apps/web/src/app/shrines/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getShrine } from "@/lib/api/shrines";

// ★ これを追加
type Params = { id: string };

export default async function ShrineDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return notFound();
  }

  const shrine = await getShrine(numericId).catch(() => null);
  if (!shrine) {
    return notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md p-4 space-y-4">
        {/* 戻る導線 */}
        <header className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/map" className="hover:underline">
            ← 地図に戻る
          </Link>
        </header>

        {/* ここに既存の「Shrine詳細カードUI」 */}
        {/* <ShrineDetailCard shrine={shrine} /> みたいな部分 */}
      </div>
    </main>
  );
}
