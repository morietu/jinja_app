import type React from "react";

import ShrineCard from "@/components/shrines/ShrineConciergeCard";
import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import ShrineProposalSection from "@/components/shrine/detail/ShrineProposalSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";

import type { ShrineTag } from "@/lib/shrine/tags/types";
import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel, ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

type JudgeSectionItem = {
  key: string;
  title: string;
  body: string;
};

export default function ShrineDetailArticle({
  cardProps,
  heroImageUrl,
  benefitLabels,
  tags: _tags = [],
  symbolTags = [],
  addGoshuinHref,
  judge,
  conciergeBreakdown = null,
  exp,
  proposal,
  proposalLead,
  proposalWhy = [],
  judgeSection = null,
  publicGoshuinsPreview = [],
  publicGoshuinsViewAllHref = "",
  saveActionNode,
}: {
  cardProps: ShrineCardAdapterProps;
  heroImageUrl?: string | null;
  benefitLabels: string[];
  tags?: ShrineTag[];
  symbolTags?: string[];

  publicGoshuinsPreview: PublicGoshuinItem[];
  publicGoshuinsViewAllHref: string;

  addGoshuinHref?: string | null;
  judge: { title: string; summary: string; level: SignalLevel; hint?: string | null };
  conciergeBreakdown?: ConciergeBreakdown | null;
  exp: ShrineExplanation;
  proposal?: string;
  proposalLead?: string;
  proposalWhy?: Array<{
    label: "相談との一致" | "神社のご利益" | "補助的な一致" | "上位になった理由" | "他候補との差";
    text: string;
  }>;
  judgeSection?: {
    disclosureTitle?: string;
    title: string;
    lead: string;
    items: JudgeSectionItem[];
  } | null;
  saveActionNode?: React.ReactNode;
}) {
  const heroCardProps = { ...cardProps, imageUrl: heroImageUrl ?? cardProps.imageUrl ?? null };

  const benefitTagObjs = _tags.filter(
    (t) => t.type === "benefit" && (t.confidence === "high" || t.confidence === "mid"),
  );

  const benefitSummary =
    benefitTagObjs.length > 0
      ? benefitTagObjs
          .map((t) => t.label)
          .filter(Boolean)
          .slice(0, 2)
          .join(" / ")
      : benefitLabels.length > 0
        ? benefitLabels.slice(0, 2).join(" / ")
        : "準備中";

  const visibleSymbolTags = symbolTags.filter(Boolean).slice(0, 4);

  return (
    <article className="space-y-4">
      <ShrineCard {...heroCardProps} variant="hero" hideDetailLink hideDescription suppressHeroCopy />

      <ShrineProposalSection
        proposal={proposal}
        proposalLead={proposalLead}
        proposalWhy={proposalWhy}
        symbolTags={visibleSymbolTags}
      />

      <section id="goshuins">
        <PublicGoshuinSection
          items={publicGoshuinsPreview}
          addGoshuinHref={addGoshuinHref}
          sendingLabel={undefined}
          limit={3}
          seeAllHref={publicGoshuinsViewAllHref ? publicGoshuinsViewAllHref : null}
          seeAllLabel="すべて見る"
        />
      </section>

      <div className="space-y-2">
        <DetailDisclosureBlock
          title={judgeSection?.disclosureTitle ?? "おすすめの根拠"}
          summary={judge.summary || "この神社をおすすめする理由です"}
          defaultOpen={false}
          level={judge.level}
          hint={judge.hint}
        >
          <ShrineJudgeSection concierge={conciergeBreakdown} exp={exp} judgeSection={judgeSection} />
        </DetailDisclosureBlock>

        <DetailDisclosureBlock title="ご利益" summary={benefitSummary} defaultOpen={false}>
          {benefitTagObjs.length ? (
            <div className="flex flex-wrap gap-1">
              {benefitTagObjs.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                >
                  {t.label}
                </span>
              ))}
            </div>
          ) : benefitLabels.length ? (
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
          ) : (
            <p className="text-xs text-slate-400">ご利益情報は準備中です。</p>
          )}
        </DetailDisclosureBlock>
      </div>

      {saveActionNode ? (
        <section className="pt-4">
          <div className="rounded-2xl border bg-emerald-50 p-4">
            <div className="mb-2 text-sm text-slate-700">気になったら保存して、あとで見返せます</div>
            {saveActionNode}
          </div>
        </section>
      ) : null}
    </article>
  );
}
