// apps/web/src/app/shrines/hub/[id]/page.tsx
import { redirect } from "next/navigation";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { buildShrineResolveHref } from "@/lib/nav/buildShrineResolveHref";


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
    const query = Object.fromEntries(q.entries());
    redirect(buildShrineHref(numericId, { query: Object.keys(query).length ? query : undefined }));
  }

  // 数値じゃなければ place_id とみなして resolve へ
  const q2 = new URLSearchParams(q);
  q2.set("place_id", id);

  // q2 を渡す（ここが正）
  const query2 = Object.fromEntries(q2.entries());
  redirect(
    buildShrineResolveHref(id, {
      query: Object.keys(query2).length ? query2 : undefined,
    }),
  );
}
