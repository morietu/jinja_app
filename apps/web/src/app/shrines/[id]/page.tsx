// apps/web/src/app/shrines/[id]/page.tsx
import Link from "next/link";

import { getShrine, type Shrine } from "@/lib/api/shrines";

import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import { gmapsDirUrl } from "@/lib/maps";
import { ShrineDetailToast } from "@/components/shrine/ShrineDetailToast";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import ShrineDetailArticle from "@/components/shrine/detail/ShrineDetailArticle";
import { buildShrineClose } from "@/lib/navigation/shrineClose";

import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

import { getConciergeThread } from "@/lib/api/concierge";
import { fetchPublicGoshuinsForShrine } from "@/lib/api/publicGoshuins";
import { buildShrineJudge } from "@/lib/shrine/buildShrineJudge";

import { getBenefitLabels } from "@/lib/shrine/getBenefitLabels";
import { pickBreakdownFromThread } from "@/lib/concierge/pickBreakdownFromThread";


import type { ConciergeBreakdown } from "@/lib/api/concierge";


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
  const from = encodeURIComponent(`/shrines/${numericId}${qs.toString() ? `?${qs.toString()}` : ""}`);

  // ✅ 御朱印登録の唯一入口はここ
  const addGoshuinHref = `/goshuin/new?shrine=${numericId}&from=${from}`;

  let shrine: Shrine | null = null;
  try {
    shrine = await getShrine(numericId);
  } catch {
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
      >
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700">
          神社の詳細情報が見つかりませんでした。
        </div>
      </ShrineDetailShell>
    );
  }

  const s = shrine;

  const pageTitle = (s.name_jp ?? "").trim() || `神社 #${numericId}`;

  
  const latNum = Number(s.lat ?? s.latitude ?? NaN);
  const lngNum = Number(s.lng ?? s.longitude ?? NaN);
  const hasLocation =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180;

  const googleDirHref = hasLocation ? gmapsDirUrl({ dest: { lat: latNum, lng: lngNum }, mode: "walk" }) : null;
  const benefitLabels = getBenefitLabels(s);

  const nextPath = `/shrines/${numericId}${qs.toString() ? `?${qs.toString()}` : ""}`;

  // ✅ ShrineCard用のpropsを構築
  const { cardProps } = buildShrineCardProps(s);

  const publicGoshuins = await fetchPublicGoshuinsForShrine(numericId);
  
  

  let conciergeBreakdown: ConciergeBreakdown | null = null;

  if (ctx === "concierge" && tid) {
    try {
      const thread = await getConciergeThread(String(tid));
      conciergeBreakdown = pickBreakdownFromThread(thread, numericId);
    } catch {
      conciergeBreakdown = null;
    }
  }

  const exp = buildShrineExplanation({
    shrine: s,
    signals: { publicGoshuinsCount: publicCount },
  });
  const judge = buildShrineJudge(exp, conciergeBreakdown);

 


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
      >
        <ShrineDetailArticle
          cardProps={cardProps}
          benefitLabels={benefitLabels}
          publicGoshuins={publicGoshuins}
          addGoshuinHref={addGoshuinHref}
          judge={judge}
          conciergeBreakdown={conciergeBreakdown}
          exp={exp}
        />
      </ShrineDetailShell>
    </>
  );
}
