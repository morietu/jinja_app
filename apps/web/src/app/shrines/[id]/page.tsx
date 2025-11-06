// apps/web/src/app/shrines/[id]/page.tsx
import { notFound } from "next/navigation";
import { headers } from "next/headers";

type Params = { id: string };

export default async function ShrineDetailPage({
  params,
}: {
  params: Promise<Params>; // ★ Next 15: Promise を受け取る
}) {
  const { id } = await params; // ★ 必ず await

  // ★ 絶対URLを組み立て（PWの env を最優先）
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base =
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    `${proto}://${host}`;

  const res = await fetch(`${base}/api/shrines/${id}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const data = await res.json();

  return (
    <main className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{data?.name ?? "神社詳細"}</h1>
      {data?.description && <p className="text-gray-700">{data.description}</p>}
    </main>
  );
}
