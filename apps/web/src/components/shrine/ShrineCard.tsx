// apps/web/src/components/shrine/ShrineCard.tsx
"use client";

import * as React from "react";
import ConciergeCard from "@/components/ConciergeCard";
import { useFavorite } from "@/hooks/useFavorite";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildOneLiner } from "@/lib/concierge/pickAClause";

import ConciergeBreakdownBody, { pickReasonLabel } from "@/components/concierge/ConciergeBreakdownBody";

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
  badgesOverride?: string[];
};


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
  badgesOverride,
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
  
  
  const defaultBadges = ["正式登録", reasonLabel ? `おすすめ理由：${reasonLabel}` : null]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, 2);

  const badges =
    badgesOverride?.filter((v): v is string => typeof v === "string" && v.trim().length > 0) ?? defaultBadges;

  const addr = (address ?? "").trim() || "住所情報は準備中です。";

  return (
    <ConciergeCard
      title={title}
      address={addr}
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
            <DisclosureSection title="おすすめ理由（内訳）">
              <ConciergeBreakdownBody breakdown={breakdown} />
            </DisclosureSection>
          ) : null}

          <DisclosureSection title="要点">
            <p className="text-sm text-slate-700 line-clamp-2">{buildOneLiner(breakdown)}</p>
          </DisclosureSection>
        </div>
      }
    />
  );
}
