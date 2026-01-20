// apps/web/src/components/shrine/ShrineCard.tsx
"use client";

import * as React from "react";
import ConciergeCard from "@/components/ConciergeCard";
import { useFavorite } from "@/hooks/useFavorite";
import type { ConciergeBreakdown } from "@/lib/api/concierge";



type Props = {
  shrineId: number;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
  showFavorite?: boolean;

  /** 表示制御 */

  readOnly?: boolean;

  /** お気に入り初期値 */
  initialFav?: boolean;

  /**
   * 詳細リンクを上書きできるようにする（map/concierge対策）
   * 例: `/shrines/from-place/${placeId}?ctx=map`
   */
  detailHref?: string;

  /** concierge のおすすめ内訳（任意） */
  breakdown?: ConciergeBreakdown | null;

  
};

function toNum(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function pickReasonLabel(b?: ConciergeBreakdown | null): string | null {
  if (!b) return null;

  const w = b.weights ?? { element: 0, need: 0, popular: 0 };

  const contrib = {
    element: toNum(b.score_element) * toNum(w.element),
    need: toNum(b.score_need) * toNum(w.need),
    popular: toNum(b.score_popular) * toNum(w.popular),
  } as const;

  const entries = Object.entries(contrib) as Array<[keyof typeof contrib, number]>;
  entries.sort((a, c) => c[1] - a[1]);

  const [topKey, topVal] = entries[0] ?? [null, 0];
  if (!topKey || topVal <= 0) return null;

  if (topKey === "need") return (b.matched_need_tags?.length ?? 0) > 0 ? "ご利益が一致" : "希望条件に合う";
  if (topKey === "element") return "雰囲気が合う";
  if (topKey === "popular") return "人気の傾向を考慮";
  return null;
}

/** ✅ “中で枠を作らない” = DisclosureSectionに任せる */
function renderBreakdownBody(b?: ConciergeBreakdown | null) {
  if (!b) return null;

  const se = toNum(b.score_element);
  const sn = toNum(b.score_need);
  const sp = toNum(b.score_popular);

  const hasAny = se > 0 || sn > 0 || sp > 0;
  const matched = Array.isArray(b.matched_need_tags) ? b.matched_need_tags.filter(Boolean) : [];
  const shownTags = matched.slice(0, 2);

  if (!hasAny) {
    return <div className="text-xs text-slate-600">条件情報が少ないため、複数要素を総合して表示しています。</div>;
  }

  return (
    <ul className="space-y-1 text-xs text-slate-700">
      {sn > 0 ? (
        <li className="flex flex-wrap items-center gap-1">
          <span className="text-slate-600">ご利益：</span>
          {shownTags.length > 0 ? (
            shownTags.map((t) => (
              <span key={t} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px]">
                {t}
              </span>
            ))
          ) : (
            <span className="text-slate-700">希望条件に合致</span>
          )}
          {matched.length > shownTags.length ? <span className="text-slate-500">ほか</span> : null}
        </li>
      ) : null}

      {se > 0 ? (
        <li>
          <span className="text-slate-600">雰囲気・属性：</span>一致
        </li>
      ) : null}
      {sp > 0 ? (
        <li>
          <span className="text-slate-600">人気：</span>考慮
        </li>
      ) : null}
    </ul>
  );
}

function DisclosureSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  );
}

export default function ShrineCard({
  shrineId,
  title,
  address,
  description,
  imageUrl,
  showFavorite = true,
  initialFav = false,
  readOnly = false,
  detailHref,
  breakdown,
}: Props) {
  const { fav, busy, toggle } = useFavorite({ shrineId, initial: initialFav });

  const favButton = !showFavorite ? null : (
    <button
      onClick={toggle}
      disabled={busy || readOnly}
      className="text-sm font-semibold"
      aria-pressed={fav}
      aria-label={fav ? "お気に入り解除" : "お気に入りに追加"}
      title={fav ? "お気に入り解除" : "お気に入りに追加"}
    >
      {fav ? "★" : "☆"}
    </button>
  );

  const safeDetailHref = detailHref ?? (Number.isFinite(shrineId) ? `/shrines/${shrineId}` : undefined);

  // ✅ バッジは “要約” に寄せる（重複感を減らす）
  const reasonLabel = pickReasonLabel(breakdown);
  const badges = (["正式登録", reasonLabel ? `おすすめ理由：${reasonLabel}` : null].filter(Boolean) as string[]).slice(
    0,
    2,
  );

  return (
    <ConciergeCard
      title={title}
      address={address}
      imageUrl={imageUrl}
      description={description}
      isPrimary
      badges={badges}
      detailHref={safeDetailHref}
      headerRight={favButton}
      disclosureTitle="おすすめ理由を見る"
      disclosureBody={
        <div className="space-y-3">
          {breakdown ? (
            <DisclosureSection title="おすすめ理由（内訳）">{renderBreakdownBody(breakdown)}</DisclosureSection>
          ) : null}

          <DisclosureSection title="要点">
            <p className="text-sm text-slate-700 line-clamp-2">{description}</p>
          </DisclosureSection>
        </div>
      }
    />
  );
}
