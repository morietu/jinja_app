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
  judge: { title: string; summary: string; level: SignalLevel; hint?: string | null };
  conciergeBreakdown?: ConciergeBreakdown | null;
  exp: ShrineExplanation;
}) {
  const heroCardProps = {
    ...cardProps,
    imageUrl: heroImageUrl ?? cardProps.imageUrl ?? null,
  };

  const subtitle = pickHeroSubtitle(exp, cardProps?.description);

  // 1) benefit tags（表示用オブジェクト）
  const benefitTagObjs = _tags.filter(
    (t) => t.type === "benefit" && (t.confidence === "high" || t.confidence === "mid"),
  );

  // 2) benefit summary（Disclosureのサマリ）
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

  // 3) materials 用の derived 一致
  const needTags = Array.isArray(conciergeBreakdown?.matched_need_tags)
    ? conciergeBreakdown.matched_need_tags.filter(Boolean)
    : [];

  const benefitTagLabels = benefitTagObjs.map((t) => t.label).filter(Boolean);

  const norm = (s: string) => s.trim();
  const benefitSet = new Set(benefitTagLabels.map(norm));
  const intersection = needTags.map(norm).filter((t) => benefitSet.has(t));

  const matchedText =
    intersection.length > 0
      ? `${intersection.slice(0, 3).join(" / ")}${intersection.length > 3 ? " ほか" : ""}`
      : needTags.length > 0
        ? `${needTags.slice(0, 3).join(" / ")}${needTags.length > 3 ? " ほか" : ""}`
        : "なし";

  const goshuinsCount = exp?.signals?.publicGoshuinsCount;
  const goshuinsText = typeof goshuinsCount === "number" ? `${goshuinsCount}件` : "未計測";

  const basisText = intersection.length > 0 ? "ご利益タグが一致" : needTags.length > 0 ? "希望条件に合う" : "情報が少ない";

  const materials = [
    { label: "一致", value: matchedText },
    { label: "公開御朱印", value: goshuinsText },
    { label: "根拠", value: basisText },
  ];

  // 4) derivedLevel（材料が揃った後に決める）
  const hasNeed = needTags.length > 0;
  const hasBenefit = (typeof goshuinsCount === "number" && goshuinsCount >= 3) || exp?.hasSignal;

  let derivedLevel: SignalLevel | "low" = exp.signalLevel;
  if (hasNeed && derivedLevel === "weak") derivedLevel = "medium";
  if (!hasNeed && !hasBenefit) derivedLevel = "low";

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
          level={derivedLevel} // ✅ judge.level じゃなく derived を渡す
          hint={judge.hint}
          materials={materials} // ✅ これを忘れると「材料」が出ない
        >
          <ShrineJudgeSection
            judgeTitle={judge.title}
            judgeLevel={derivedLevel} // ✅ 表示レベルを揃える
            judgeSummary={judge.summary}
            judgeHint={judge.hint}
            concierge={conciergeBreakdown}
            exp={exp}
          />
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
