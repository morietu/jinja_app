// apps/web/src/app/shrines/[id]/goshuins/page.tsx
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import Link from "next/link";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import { buildShrineClose } from "@/lib/navigation/shrineClose";
import { fetchPublicGoshuinsForShrine } from "@/lib/api/publicGoshuins";
import PublicGoshuinSection from "@/components/shrine/detail/PublicGoshuinSection";

function normalizeCtx(v?: string | null): "map" | "concierge" | null {
  return v === "map" || v === "concierge" ? v : null;
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ctx?: string; tid?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const ctx = normalizeCtx(sp.ctx ?? null);
  const tid = sp.tid ?? null;

  const shrineId = Number(id);
  const close = buildShrineClose({ ctx, tid });

  if (!Number.isFinite(shrineId) || shrineId <= 0) {
    return (
      <main className="mx-auto max-w-md space-y-6 p-4">
        <div className="rounded-xl border bg-white p-4 text-center text-sm">不正な神社IDです。</div>
      </main>
    );
  }

  // ✅ 先にクエリを作る
  const qs = new URLSearchParams();
  if (ctx) qs.set("ctx", ctx);
  if (tid) qs.set("tid", String(tid));
  const q = qs.toString();

  const items = await fetchPublicGoshuinsForShrine(shrineId);

  const query = q ? Object.fromEntries(new URLSearchParams(q).entries()) : undefined;

  const backHref = buildShrineHref(shrineId, { query });

  // ✅ 御朱印追加（この一覧に戻す）
  const fromPath = buildShrineHref(shrineId, { subpath: "goshuins", query });
  const addGoshuinHref = `/goshuin/new?shrine=${shrineId}&from=${encodeURIComponent(fromPath)}`;

  return (
    <ShrineDetailShell
      title="公開御朱印"
      subtitle={null}
      close={close}
      addGoshuinHref={null}
      googleDirHref={null}
      saveAction={null}
      googleDirFallbackText="経路案内を準備できませんでした。"
    >
      <PublicGoshuinSection items={items} addGoshuinHref={addGoshuinHref} seeAllHref={null} />

      <div className="pt-4">
        <Link href={backHref} className="text-xs text-slate-600 hover:underline">
          ← 神社詳細に戻る
        </Link>
      </div>
    </ShrineDetailShell>
  );
}
