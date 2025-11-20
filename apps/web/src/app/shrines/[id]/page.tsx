// apps/web/src/app/shrines/[id]/page.tsx
import Link from "next/link";

import { notFound } from "next/navigation";
import { getShrine } from "@/lib/api/shrines";
import ShrineCard from "@/components/ShrineCard";

type Props = { params: { id: string } };

export default async function ShrineDetailPage({ params }: Props) {
  const id = Number(params.id);
  if (Number.isNaN(id)) return notFound();

  const shrine = await getShrine(id).catch(() => null);
  if (!shrine) return notFound();

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
