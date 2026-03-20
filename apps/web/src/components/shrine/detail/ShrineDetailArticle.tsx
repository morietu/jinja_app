import type React from "react";

import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import ShrineProposalSection from "@/components/shrine/detail/ShrineProposalSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";
import ShrineConciergeCard from "@/components/shrines/ShrineConciergeCard";
import type { ShrineTag } from "@/lib/shrine/tags/types";
import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel, ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

export default function ShrineDetailArticle({
  cardProps,
  heroImageUrl,
  benefitLabels,
  tags: _tags = [],
  addGoshuinHref,
  judge,
  conciergeBreakdown = null,
  exp,
  proposal,
  proposalReason,
  compatSummary = null,
  compatReason = null,
  publicGoshuinsPreview = [],
  publicGoshuinsViewAllHref = "",
  saveActionNode,
}: {
  cardProps: ShrineCardAdapterProps;
  heroImageUrl?: string | null;
  benefitLabels: string[];
  tags?: ShrineTag[];

  publicGoshuinsPreview: PublicGoshuinItem[];
  publicGoshuinsViewAllHref: string;

  addGoshuinHref?: string | null;
  judge: { title: string; summary: string; level: SignalLevel; hint?: string | null };
  conciergeBreakdown?: ConciergeBreakdown | null;
  exp: ShrineExplanation;
  proposal?: string;
  proposalReason?: string;
  compatSummary?: string | null;
  compatReason?: string | null;
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

  const resolvedProposal = proposal || "この神社の性質に合う形で、気持ちや流れを整えやすい参拝先です。";

  const resolvedProposalReason = proposalReason || "ご利益や神社の性質から見て、今回の参拝目的と接点があります。";

  const hasCompatBlock = Boolean((compatSummary && compatSummary.trim()) || (compatReason && compatReason.trim()));

  return (
    <article className="space-y-4">
      <ShrineConciergeCard {...heroCardProps} variant="hero" hideDetailLink hideDescription suppressHeroCopy />

      <ShrineProposalSection proposal={resolvedProposal} proposalReason={resolvedProposalReason} />

      {hasCompatBlock ? (
        <section className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <div className="text-xs font-semibold text-sky-700">あなたとの相性</div>

          {compatSummary ? <div className="mt-1 text-sm font-semibold text-slate-900">{compatSummary}</div> : null}

          {compatReason ? <div className="mt-1 text-xs leading-5 text-slate-700">{compatReason}</div> : null}
        </section>
      ) : null}

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
          title="相性の根拠"
          summary={judge.summary || "おすすめの根拠を確認できます"}
          defaultOpen={false}
          level={judge.level}
          hint={judge.hint}
        >
          <ShrineJudgeSection concierge={conciergeBreakdown} exp={exp} />
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
