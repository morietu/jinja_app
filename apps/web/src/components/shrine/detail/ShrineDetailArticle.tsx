// apps/web/src/components/shrine/detail/ShrineDetailArticle.tsx
import ShrineCard from "@/components/shrine/ShrineCard";
import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";

import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel, ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

export default function ShrineDetailArticle({
  cardProps,
  benefitLabels,
  publicGoshuins,
  addGoshuinHref,
  judge,
  conciergeBreakdown = null,
  exp,
}: {
  cardProps: ShrineCardAdapterProps;
  benefitLabels: string[];
  publicGoshuins: PublicGoshuinItem[];
  addGoshuinHref?: string | null;
  judge: { title: string; summary: string; level: SignalLevel; hint: string | null };
  conciergeBreakdown?: ConciergeBreakdown | null;
  exp: ShrineExplanation;
}) {
  return (
    <article className="space-y-4">
      {/* 1) Hero（常に見せる / 詳細では静かに） */}
      <ShrineCard {...cardProps} breakdown={null} variant="detail" hideDetailLink showFavorite={false} />

      {/* 2) 公開御朱印（常に見せる） */}
      <section id="goshuins">
        <PublicGoshuinSection items={publicGoshuins} addGoshuinHref={addGoshuinHref ?? null} />
      </section>

      {/* 3) それ以外（情報は折りたたみ） */}
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
