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
import { buildConciergeHint } from "@/components/concierge/ConciergeBreakdownBody";
import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";
import { buildOneLiner } from "@/lib/concierge/pickAClause";
import { getConciergeThread } from "@/lib/api/concierge"; 
import type { SignalLevel } from "@/lib/shrine/buildShrineExplanation";
import type { ConciergeBreakdown } from "@/lib/api/concierge";





function normalizeCtx(v?: string | null): "map" | "concierge" | null {
  return v === "map" || v === "concierge" ? v : null;
}

function getBenefitLabels(shrine: Shrine): string[] {
  if (Array.isArray(shrine.goriyaku_tags) && shrine.goriyaku_tags.length > 0) {
    return shrine.goriyaku_tags.map((t) => t?.name?.trim()).filter((name): name is string => Boolean(name));
  }
  if (typeof shrine.goriyaku === "string" && shrine.goriyaku.trim().length > 0) {
    return shrine.goriyaku
      .split(/[、,／/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}


function pickBreakdownFromThread(thread: unknown, shrineId: number): ConciergeBreakdown | null {
  const t = thread as any;
  const recs = t?.recommendations ?? t?.recommendations_v2 ?? [];
  if (!Array.isArray(recs)) return null;

  const hit = recs.find((r: any) => Number(r?.shrine?.id ?? r?.shrine_id ?? r?.shrineId) === shrineId);
  return (hit?.breakdown ?? hit?.reason_breakdown ?? null) as ConciergeBreakdown | null;
}




type PublicGoshuin = {
  id: number;
  shrine?: number;
  shrine_name?: string | null;
  title?: string | null;
  is_public: boolean;
  likes?: number;
  created_at?: string;
  image_url?: string | null;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

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

  // ✅ その神社の「公開御朱印」だけ（shrine必須）
  let publicGoshuins: PublicGoshuin[] = [];
  try {
    const res = await fetch(`/api/public/goshuins?limit=12&offset=0&shrine=${numericId}`, { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as unknown;
      const results = Array.isArray(json)
        ? (json as PublicGoshuin[])
        : ((json as Paginated<PublicGoshuin>)?.results ?? []);
      publicGoshuins = results;
    }
  } catch {
    publicGoshuins = [];
  }

  

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
  const publicCount = publicGoshuins.length; // まずはこれで暫定OK（limit=12でも十分）
  
  let conciergeBreakdown: ConciergeBreakdown | null = null;

  if (ctx === "concierge" && tid) {
    try {
      const thread = await getConciergeThread(String(tid));
      conciergeBreakdown = pickBreakdownFromThread(thread, numericId);
    } catch {
      conciergeBreakdown = null;
    }
  }

  const exp = buildShrineExplanation({ shrine: s, publicCount });

 
  const concierge = conciergeBreakdown; // alias（読みやすさ用）

  const useConcierge = concierge !== null;

  const judgeTitle = useConcierge ? "おすすめ理由" : exp.hasSignal ? "判断材料" : "目安";
  const judgeLevel: SignalLevel = useConcierge ? "strong" : exp.signalLevel;
  
  const judgeSummary = useConcierge ? buildOneLiner(concierge) : exp.summary;
  const judgeHint = useConcierge ? buildConciergeHint(concierge) : exp.strongHint;

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
          judge={{ title: judgeTitle, summary: judgeSummary, level: judgeLevel, hint: judgeHint }}
          conciergeBreakdown={concierge}
          exp={exp}
        />
        
          

          


          
        
      </ShrineDetailShell>
    </>
  );
}
