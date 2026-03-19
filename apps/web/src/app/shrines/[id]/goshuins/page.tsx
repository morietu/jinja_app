// apps/web/src/app/shrines/[id]/goshuins/page.tsx
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import Link from "next/link";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import { buildShrineClose } from "@/lib/navigation/shrineClose";
import { fetchPublicGoshuinsForShrineServer } from "@/lib/api/publicGoshuins.server";
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

  const qs = new URLSearchParams();
  if (ctx) qs.set("ctx", ctx);
  if (tid) qs.set("tid", String(tid));
  const q = qs.toString();

  const items = await fetchPublicGoshuinsForShrineServer(shrineId);

  const query = q ? Object.fromEntries(new URLSearchParams(q).entries()) : undefined;
  const backHref = buildShrineHref(shrineId, { query });

  const fromPath = buildShrineHref(shrineId, { subpath: "goshuins", query });
  const addQ = new URLSearchParams();
  addQ.set("shrine", String(shrineId));
  addQ.set("shrine_id", String(shrineId));
  addQ.set("from", fromPath);
  if (ctx) addQ.set("ctx", ctx);
  if (tid) addQ.set("tid", String(tid));

  const addGoshuinHref = `/goshuin/new?${addQ.toString()}`;

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
      <div className="space-y-4">
        <div className="rounded-xl border bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">この神社に残された御朱印を一覧で見られます。</p>
          <p className="mt-1 text-xs text-slate-500">まだ公開御朱印がない場合は、最初の記録を残せます。</p>
        </div>

        <PublicGoshuinSection items={items} addGoshuinHref={addGoshuinHref} seeAllHref={null} />

        <div className="pt-1">
          <Link href={backHref} className="text-xs text-slate-600 hover:underline">
            ← 神社詳細に戻る
          </Link>
        </div>
      </div>
    </ShrineDetailShell>
  );
    
}
