// apps/web/src/app/shrines/[id]/page.tsx
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
    <main className="p-4 max-w-md mx-auto">
      <ShrineCard shrine={shrine} />
    </main>
  );
}
