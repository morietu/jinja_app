import ShrineCard from "@/components/shrine/ShrineCard";
import DetailSection from "@/components/shrine/DetailSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import GoshuinLimitBadge from "@/components/shrine/detail/GoshuinLimitBadge";


import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel } from "@/lib/shrine/buildShrineExplanation";


export default function ShrineDetailArticle({
  cardProps,
  benefitLabels,
  publicGoshuins,
  addGoshuinHref,
  judge,
  conciergeBreakdown,
  exp,
}: {
  cardProps: ShrineCardAdapterProps;
  benefitLabels: string[];
  publicGoshuins: PublicGoshuinItem[];
  addGoshuinHref: string;
  judge: { title: string; summary: string; level: SignalLevel; hint: string | null };
  conciergeBreakdown: ConciergeBreakdown | null;
  exp: {
    hasSignal: boolean;
    fit: string;
    unfit: string;
    howto: string;
    note: string;
    summary: string;
    strongHint: string | null;
    signalLevel: SignalLevel;
  };
}) {


  return (
    <article className="space-y-4">
      <ShrineCard {...cardProps} breakdown={null} />

      <ShrineJudgeSection
        judgeTitle={judge.title}
        judgeLevel={judge.level}
        judgeSummary={judge.summary}
        judgeHint={judge.hint}
        concierge={conciergeBreakdown}
        exp={exp}
      />
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

      <GoshuinLimitBadge />

      <PublicGoshuinSection items={publicGoshuins} addGoshuinHref={addGoshuinHref} />
    </article>
  );
}
