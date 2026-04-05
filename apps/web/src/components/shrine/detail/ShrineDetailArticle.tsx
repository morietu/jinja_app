import type React from "react";

import ShrineCard from "@/components/shrines/ShrineConciergeCard";
import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import ShrineProposalSection from "@/components/shrine/detail/ShrineProposalSection";
import ShrineReasonSection from "@/components/shrine/detail/ShrineReasonSection";
import ShrineSupplementSection from "@/components/shrine/detail/ShrineSupplementSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";
import { RecommendationMetaSection } from "@/components/shrine/detail/RecommendationMetaSection";

import type { ShrineTag } from "@/lib/shrine/tags/types";
import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import type { ShrineDetailSectionModel } from "@/components/shrine/detail/types";

function ShrineDetailSections({ sections }: { sections: ShrineDetailSectionModel[] }) {
  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        const key = `${section.kind}:${index}`;

        switch (section.kind) {
          case "reason":
            return <ShrineReasonSection key={key} section={section} />;
          case "proposal":
            return <ShrineProposalSection key={key} section={section} />;
          case "meaning":
            return <ShrineJudgeSection key={key} section={section} />;
          case "supplement":
            return <ShrineSupplementSection key={key} section={section} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

export default function ShrineDetailArticle({
  cardProps,
  heroImageUrl,
  benefitLabels,
  tags: _tags = [],
  addGoshuinHref,
  publicGoshuinsPreview = [],
  publicGoshuinsViewAllHref = "",
  sections = [],
  recommendationMeta = null,
  saveActionNode,
}: {
  cardProps: ShrineCardAdapterProps;
  heroImageUrl?: string | null;
  benefitLabels: string[];
  tags?: ShrineTag[];
  publicGoshuinsPreview: PublicGoshuinItem[];
  publicGoshuinsViewAllHref: string;
  addGoshuinHref?: string | null;
  sections?: ShrineDetailSectionModel[];
  recommendationMeta?: {
    rankTitle?: string | null;
    rankBody?: string | null;
    rankComparison?: {
      is_top?: boolean;
      gap_from_top?: number;
    } | null;
  } | null;
  saveActionNode?: React.ReactNode;
}) {
  const heroCardProps = { ...cardProps, imageUrl: heroImageUrl ?? cardProps.imageUrl ?? null };

  const hasSections = sections.length > 0;

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

  return (
    <article className="space-y-4">
      <ShrineCard {...heroCardProps} variant="hero" hideDetailLink hideDescription suppressHeroCopy />

      {recommendationMeta ? <RecommendationMetaSection recommendationMeta={recommendationMeta} /> : null}

      {hasSections ? <ShrineDetailSections sections={sections} /> : null}

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

      {!hasSections ? (
        <div className="space-y-2">
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
      ) : null}

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
