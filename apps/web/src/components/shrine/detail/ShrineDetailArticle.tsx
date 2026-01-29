import ShrineCard from "@/components/shrine/ShrineCard";
import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";

import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel, ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

export default function ShrineDetailArticle({
  cardProps,
  heroImageUrl,
  benefitLabels,
  addGoshuinHref,
  judge,
  conciergeBreakdown = null,
  exp,
  publicGoshuinsPreview = [],
  publicGoshuinsHasMore = false,
  publicGoshuinsViewAllHref = "",
}: {
  cardProps: ShrineCardAdapterProps;
  heroImageUrl?: string | null;
  benefitLabels: string[];

  publicGoshuinsPreview: PublicGoshuinItem[];
  publicGoshuinsHasMore: boolean;
  publicGoshuinsViewAllHref: string;

  addGoshuinHref?: string | null;
  judge: { title: string; summary: string; level: SignalLevel; hint: string | null };
  conciergeBreakdown?: ConciergeBreakdown | null;
  exp: ShrineExplanation;
}) {
  const heroCardProps = {
    ...cardProps,
    imageUrl: heroImageUrl ?? cardProps.imageUrl ?? null,
    description: "", // ← ここで被りを止める
    badges: [], // ← バッジも被るなら消す
  };
  


  return (
    <article className="space-y-4">
      <ShrineCard {...heroCardProps} breakdown={null} variant="detail" hideDetailLink showFavorite={false} />

      {/* 公開御朱印（3枚 + 条件付きで「すべて見る」） */}
      <section id="goshuins">
        <PublicGoshuinSection
          items={publicGoshuinsPreview}
          addGoshuinHref={addGoshuinHref}
          sendingLabel="最新3枚（公開）"
          hasMore={publicGoshuinsHasMore}
          seeAllHref={publicGoshuinsHasMore ? publicGoshuinsViewAllHref : null}
          seeAllLabel="すべて見る"
        />
      </section>

      <div className="space-y-2">
        <DetailDisclosureBlock
          title="相性の根拠"
          summary={judge.summary || "おすすめの根拠を確認できます"}
          defaultOpen={false}
        >
          <ShrineJudgeSection
            judgeTitle={judge.title}
            judgeLevel={judge.level}
            judgeSummary={judge.summary}
            judgeHint={judge.hint}
            concierge={conciergeBreakdown}
            exp={exp}
          />
        </DetailDisclosureBlock>

        <DetailDisclosureBlock
          title="ご利益"
          summary={benefitLabels.length ? benefitLabels.slice(0, 2).join(" / ") : "準備中"}
          defaultOpen={false}
        >
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
        </DetailDisclosureBlock>
      </div>
    </article>
  );
}
