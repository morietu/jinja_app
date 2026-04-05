/**
 * 一覧の catchCopy:
 * - 候補を開く理由を短く伝える入口コピー
 * - 一覧での期待を作る役割を持つ
 *
 * 詳細の heroMeaningCopy:
 * - この神社を今どう受け取るかを定義する意味宣言
 * - 一覧の要約ではなく、詳細画面で最初に読む主文として使う
 * - 詳細では「意味 → 理由 → 本文」の順に理解を進める
 */
import type React from "react";

import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import ShrineProposalSection from "@/components/shrine/detail/ShrineProposalSection";
import ShrineReasonSection from "@/components/shrine/detail/ShrineReasonSection";
import ShrineSupplementSection from "@/components/shrine/detail/ShrineSupplementSection";
import ShrineDetailHeroCard from "@/components/shrine/detail/ShrineDetailHeroCard";
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

function ShrineDetailHeroHeader(props: { title: string; heroMeaningCopy?: string | null; address?: string | null }) {
  const resolvedHeroMeaningCopy = props.heroMeaningCopy?.trim() || "今の流れを整え、次の見方を作る神社";

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{props.title}</h1>

        <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500">この神社の意味</p>

        <p className="text-[15px] leading-7 text-slate-800">{resolvedHeroMeaningCopy}</p>

        {props.address ? <p className="text-[11px] leading-5 text-slate-400">{props.address}</p> : null}
      </div>
    </section>
  );
}

export default function ShrineDetailArticle({
  cardProps,
  heroImageUrl,
  heroMeaningCopy,
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
  heroMeaningCopy?: string | null;
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
  const hasRecommendationMeta = Boolean(recommendationMeta?.rankTitle && recommendationMeta?.rankBody);

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
      <section className="space-y-5">
        <ShrineDetailHeroHeader
          title={cardProps.title}
          heroMeaningCopy={heroMeaningCopy}
          address={cardProps.address ?? null}
        />

        {hasRecommendationMeta ? (
          <section className="pt-2">
            <RecommendationMetaSection recommendationMeta={recommendationMeta} />
          </section>
        ) : null}

        <ShrineDetailHeroCard title={cardProps.title} imageUrl={heroImageUrl} />
      </section>

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
