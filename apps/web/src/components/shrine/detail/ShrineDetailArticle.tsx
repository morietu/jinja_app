// apps/web/src/components/shrine/detail/ShrineDetailArticle.tsx
import ShrineCard from "@/components/shrines/ShrineConciergeCard";
import PublicGoshuinSection, { type PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import ShrineJudgeSection from "@/components/shrine/detail/ShrineJudgeSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";

import type { ShrineTag } from "@/lib/shrine/tags/types";
import type { ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel, ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

function pickHeroSubtitle(
  exp: ShrineExplanation | null | undefined,
  desc: string | null | undefined,
): string | undefined {
  const strong = (exp?.strongHint ?? "").trim();
  if (strong) return strong.slice(0, 28);

  const summary = (exp?.summary ?? "").trim();
  if (summary && !summary.includes("判断材料") && !summary.includes("目安") && !summary.includes("情報が少ない")) {
    return summary.slice(0, 28);
  }

  const d = (desc ?? "").trim();
  if (d && !d.includes("準備中")) return d.slice(0, 28);

  return undefined;
}

export default function ShrineDetailArticle({
  cardProps,
  heroImageUrl,
  benefitLabels,
  tags: _tags = [],
  addGoshuinHref,
  judge,
  conciergeBreakdown = null,
  exp,
  publicGoshuinsPreview = [],
  publicGoshuinsViewAllHref = "",
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
}) {
  const heroCardProps = { ...cardProps, imageUrl: heroImageUrl ?? cardProps.imageUrl ?? null };
  const subtitle = pickHeroSubtitle(exp, cardProps?.description);

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
      <ShrineCard {...heroCardProps} variant="hero" subtitle={subtitle} />

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
    </article>
  );
}
