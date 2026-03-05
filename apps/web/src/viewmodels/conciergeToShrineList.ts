// apps/web/src/viewmodels/conciergeToShrineList.ts
import type { ShrineListItem } from "@/components/shrines/ShrineList";

/**
 * Conciergeのレスポンス型は、まずはfixtureに合わせて最低限で定義。
 * 後でopenapiから生成 or zod導入に差し替えればOK。
 */
export type ConciergeResponse = {
  ok: boolean;
  data?: {
    _need?: { tags?: string[] };
    recommendations?: Array<{
      name: string;
      display_name?: string | null;
      reason?: string | null;
      location?: string | null;
      lat?: number | null;
      lng?: number | null;
      distance_m?: number | null;
      place_id?: string | null;
      shrine_id?: number | null;
      popular_score?: number | null;
      breakdown?: {
        matched_need_tags?: string[] | null;
        score_total?: number | null;
      } | null;
    }>;
  };
};

function safeId(r: NonNullable<NonNullable<ConciergeResponse["data"]>["recommendations"]>[number]) {
  if (typeof r.shrine_id === "number") return `shrine_${r.shrine_id}`;
  if (r.place_id) return `place_${r.place_id}`;
  return `name_${encodeURIComponent(r.name)}`;
}

/**
 * ここで「コンシェルジュ結果 → UI表示」へ変換する。
 * UIに渡す要素だけ作り、余計な情報は捨てる（後で必要になったら足す）。
 */
export function conciergeToShrineListItems(resp: ConciergeResponse): ShrineListItem[] {
  if (!resp?.ok) return [];
  const recs = resp.data?.recommendations ?? [];
  const fallbackTags = resp.data?._need?.tags ?? [];

  return recs.map((r) => {
    const id = safeId(r);
    const name = r.display_name ?? r.name;

    // タグは「マッチしたタグ優先」→なければ_need.tags
    const tags = (r.breakdown?.matched_need_tags?.length ? r.breakdown?.matched_need_tags : fallbackTags) ?? [];

    // rating/reviewCount がないので、ひとまず人気スコアを “ratingっぽく” 見せない（誤解の元）
    // 将来 Google rating を取れるようになったらここで差し替え。
    return {
      id,
      cardProps: {
        name,
        address: r.location ?? undefined,
        recommendReason: r.reason ?? undefined,
        distanceM: typeof r.distance_m === "number" ? r.distance_m : undefined,
        rating: undefined,
        reviewCount: undefined,
        imageUrl: null, // place photoが繋がったらここでURL組む
        tags,
        href: typeof r.shrine_id === "number" ? `/shrines/${r.shrine_id}` : undefined,
        isFavorited: false,
      },
    };
  });
}
