// apps/web/src/app/shrines/[id]/page.tsx
import { notFound } from "next/navigation";

type Params = { id: string };

type Shrine = {
  id: number;
  kind: string;
  name_jp: string;
  name_romaji: string;
  address: string;
  description?: string | null;
};

export default async function ShrineDetailPage({
  params,
}: {
  // Next 15 形式に合わせて Promise を受け取る
  params: Promise<Params>;
}) {
  const { id } = await params;

  // ★ API ベース URL は env に一本化
  // PLAYWRIGHT_BASE_URL > NEXT_PUBLIC_API_BASE_URL > ローカル 8000番
  const apiBase = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const res = await fetch(`${apiBase}/api/shrines/${id}/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    notFound();
  }

  const data = (await res.json()) as Shrine;

  return (
    <main className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{data.name_jp ?? "神社詳細"}</h1>

      <div className="space-y-1 text-sm text-gray-700">
        <p>{data.address}</p>
        {data.description && <p className="mt-2">{data.description}</p>}
      </div>
    </main>
  );
}
