// apps/web/src/components/shrine/detail/ShrineDetailArticle.tsx
import ShrineCard from "@/components/shrine/ShrineCard";
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
  publicGoshuinsHasMore = false,
  publicGoshuinsViewAllHref = "",
}: {
  cardProps: ShrineCardAdapterProps;
  heroImageUrl?: string | null;
  benefitLabels: string[];
  tags?: ShrineTag[];

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
  };

  const subtitle = pickHeroSubtitle(exp, cardProps?.description);

  const benefitTags = _tags.filter((t) => t.type === "benefit" && (t.confidence === "high" || t.confidence === "mid"));

  const benefitSummary =
    benefitTags.length > 0
      ? benefitTags
          .map((t) => t.label)
          .filter(Boolean)
          .slice(0, 2)
          .join(" / ")
      : benefitLabels.length > 0
        ? benefitLabels.slice(0, 2).join(" / ")
        : "準備中";

  return (
    <article className="space-y-4">
      {/* ① Hero（3点セット） */}
      <ShrineCard {...heroCardProps} variant="hero" subtitle={subtitle} />

      {/* ② 公開御朱印（3枚 + すべて見る） */}
      <section id="goshuins">
        <PublicGoshuinSection
          items={publicGoshuinsPreview}
          addGoshuinHref={addGoshuinHref}
          sendingLabel={undefined} // 原則出さない
          hasMore={publicGoshuinsHasMore}
          seeAllHref={publicGoshuinsHasMore ? publicGoshuinsViewAllHref : null}
          seeAllLabel="すべて見る"
        />
      </section>

      {/* ③ Disclosure 2つ */}
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

        <DetailDisclosureBlock title="ご利益" summary={benefitSummary} defaultOpen={false}>
          {benefitTags.length ? (
            <div className="flex flex-wrap gap-1">
              {benefitTags.map((t) => (
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
