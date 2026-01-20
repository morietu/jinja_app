// apps/web/src/app/shrines/[id]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { getShrine, type Shrine } from "@/lib/api/shrines";
import ShrineCard from "@/components/shrine/ShrineCard";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import { gmapsDirUrl } from "@/lib/maps";
import { ShrineDetailToast } from "@/components/shrine/ShrineDetailToast";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import { buildShrineClose } from "@/lib/navigation/shrineClose";
import DetailSection from "@/components/shrine/DetailSection";

import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";
import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

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
  const exp = buildShrineExplanation({ shrine: s, publicCount });

  const judgeTitle = exp.hasSignal ? "判断材料" : "目安";
  

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
        <article className="space-y-4">
          {/* ✅ ShrineCardを使用 */}
          <ShrineCard
            {...cardProps}
            // 詳細ページは下に「ご利益」セクションがあるので、disclosure側は消す

            // 詳細ページは concierge の内訳が無いケースが多いので、出さないならここで切る
            breakdown={null}
          />

          {/* 説明セクション（固定テンプレ） */}
          <DetailSection title="説明">
            <DetailDisclosureBlock
              title={judgeTitle}
              summary={exp.summary}
              level={exp.signalLevel}
              hint={exp.strongHint} // strongHint を追加するなら（後述）
            >
              <div className="space-y-3 text-sm text-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-500">合う人</div>
                  <p className="line-clamp-3">{exp.fit}</p>
                </div>

                {exp.hasSignal ? (
                  <>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">合いにくい人</div>
                      <p className="mt-1 line-clamp-3">{exp.unfit}</p>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500">参拝の使い方</div>
                      <p className="mt-1 line-clamp-3">{exp.howto}</p>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500">注意</div>
                      <p className="mt-1 line-clamp-3">{exp.note}</p>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-800 space-y-2">
                    <p className="text-xs text-slate-500">情報が少ないため、現時点では目安として扱ってください。</p>
                    <p className="line-clamp-3">{exp.note}</p>
                  </div>
                )}
              </div>
            </DetailDisclosureBlock>
          </DetailSection>

          {/* ご利益セクション */}
          <DetailSection title="ご利益">
            {benefitLabels.length === 0 ? (
              <p className="text-xs text-slate-400">ご利益情報は準備中です。</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {benefitLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </DetailSection>

          {/* 公開御朱印セクション */}
          <DetailSection title="公開御朱印" right="この神社の公開分のみ">
            {publicGoshuins.length === 0 ? (
              <p className="text-xs text-slate-500">この神社に紐づく公開御朱印はまだありません。</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {publicGoshuins.map((g) => (
                  <div key={g.id} className="overflow-hidden rounded-xl border bg-white">
                    <div className="aspect-[4/5] bg-slate-100">
                      {g.image_url ? (
                        <Image
                          src={g.image_url}
                          alt={g.title ?? "goshuin"}
                          width={600}
                          height={750}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs text-slate-700">{(g.title ?? "").trim() || "（タイトルなし）"}</p>
                      {g.created_at ? <p className="truncate text-[11px] text-slate-500">{g.created_at}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        </article>
      </ShrineDetailShell>
    </>
  );
}
