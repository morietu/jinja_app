// apps/web/src/app/shrines/hub/[id]/page.tsx
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ctx?: string; tid?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};

  const q = new URLSearchParams();
  if (sp.ctx) q.set("ctx", sp.ctx);
  if (sp.tid) q.set("tid", sp.tid);

  // 数値IDなら /shrines/:id へ
  const numericId = Number(id);
  if (Number.isFinite(numericId) && numericId > 0) {
    const dest = q.toString() ? `/shrines/${numericId}?${q.toString()}` : `/shrines/${numericId}`;
    redirect(dest);
  }

  // 数値じゃなければ place_id とみなして resolve へ
  const q2 = new URLSearchParams(q);
  q2.set("place_id", id);

  redirect(`/shrines/resolve?${q2.toString()}`);
}
