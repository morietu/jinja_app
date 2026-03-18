// apps/web/src/app/shrines/[id]/page.tsx
import Link from "next/link";

import type { Shrine } from "@/lib/api/shrines";
import { getShrinePublicServer } from "@/lib/api/shrines.server";
import { serverLog } from "@/lib/server/logging";

import { gmapsDirUrl } from "@/lib/maps";
import { ShrineDetailToast } from "@/components/shrine/ShrineDetailToast";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import ShrineDetailArticle from "@/components/shrine/detail/ShrineDetailArticle";
import { buildShrineClose } from "@/lib/navigation/shrineClose";
import { buildShrineDetailModel } from "@/lib/shrine/buildShrineDetailModel";

import { getConciergeThread } from "@/lib/api/concierge";
import { fetchPublicGoshuinsForShrine } from "../../../lib/api/publicGoshuins";
import { pickBreakdownFromThread } from "@/lib/concierge/pickBreakdownFromThread";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";


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

  const hideActions = false;

  const close = buildShrineClose({ ctx, tid });

  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <main className="mx-auto max-w-md space-y-6 p-4">
        <div className="rounded-xl border bg-white p-4 text-center text-sm">不正な神社IDです。</div>
        <Link href="/map" className="inline-flex items-center text-sm text-emerald-700 hover:underline">
          ← 地図に戻る
        </Link>
      </main>
    );
  }

  // from（御朱印登録の戻り先）
  const qs = new URLSearchParams();
  if (ctx) qs.set("ctx", ctx);
  if (tid) qs.set("tid", String(tid));

  // ✅ 御朱印登録の唯一入口はここ
  const query = Object.fromEntries(qs.entries());

  let shrine: Shrine | null;
  try {
    shrine = await getShrinePublicServer(numericId);
  } catch (e) {
    serverLog("error", "GET_SHRINE_FAILED", {
      shrineId: numericId,
      message: e instanceof Error ? e.message : String(e),
    });
    shrine = null;
  }

  if (!shrine) {
    return (
      <ShrineDetailShell
        title="神社の詳細"
        subtitle={null}
        close={close}
        addGoshuinHref={null}
        saveAction={null}
        googleDirHref={null}
        googleDirFallbackText="神社情報が見つからなかったため、経路案内を表示できません。"
        hideActions={hideActions} // ✅追加（一応渡しておく）
      >
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700">
          神社の詳細情報が見つかりませんでした。
        </div>
      </ShrineDetailShell>
    );
  }

  const s = shrine;

  const pageTitle = (s.name_jp ?? "").trim() || `神社 #${numericId}`;


  const latNum = Number(s.latitude ?? NaN);
  const lngNum = Number(s.longitude ?? NaN);
  const hasLocation =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180;

  const googleDirHref = hasLocation ? gmapsDirUrl({ dest: { lat: latNum, lng: lngNum }, mode: "walk" }) : null;

  const nextPath = buildShrineHref(numericId, { query: Object.keys(query).length ? query : undefined });


  // ✅ 御朱印追加導線（唯一入口）
  const addQ = new URLSearchParams();
  addQ.set("shrine", String(numericId));
  addQ.set("shrine_id", String(numericId)); // 保険（どっちでも拾えるように）
  addQ.set("from", nextPath);
  if (ctx) addQ.set("ctx", ctx);
  if (tid) addQ.set("tid", String(tid));

  const addGoshuinHref = `/goshuin/new?${addQ.toString()}`;

  // page.tsx（publicGoshuins の取得直後あたり）
  let publicGoshuins: Awaited<ReturnType<typeof fetchPublicGoshuinsForShrine>> = [];
  try {
    publicGoshuins = await fetchPublicGoshuinsForShrine(numericId);
  } catch (e) {
    serverLog("warn", "GET_PUBLIC_GOSHUINS_FAILED", {
      shrineId: numericId,
      message: e instanceof Error ? e.message : String(e),
    });
    publicGoshuins = [];
  }

  const signals = {
    publicGoshuinsCount: publicGoshuins.length,
  } satisfies NonNullable<Parameters<typeof buildShrineDetailModel>[0]["signals"]>;

  let conciergeBreakdown: ConciergeBreakdown | null = null;
  if (ctx === "concierge" && tid) {
    try {
      const thread = await getConciergeThread(String(tid));
      conciergeBreakdown = pickBreakdownFromThread(thread, numericId);
    } catch {
      conciergeBreakdown = null;
    }
  }

  const model = buildShrineDetailModel({
    shrine: s,
    publicGoshuins,
    conciergeBreakdown,
    ctx,
    tid,
    signals,
  });

  return (
    <>
      <ShrineDetailToast shrineId={numericId} />
      <ShrineDetailShell
        title={pageTitle}
        subtitle={null}
        close={close}
        addGoshuinHref={addGoshuinHref}
        googleDirHref={googleDirHref}
        googleDirLabel="Googleマップで経路案内"
        saveAction={{
          shrineId: numericId,
          nextPath,
          node: <ShrineSaveButton shrineId={numericId} nextPath={nextPath} />,
        }}
        hideActions={hideActions} // ✅追加
      >
        <ShrineDetailArticle {...model} addGoshuinHref={addGoshuinHref} />
      </ShrineDetailShell>
    </>
  );
}
