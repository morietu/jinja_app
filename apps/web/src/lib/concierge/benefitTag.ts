// apps/web/src/lib/concierge/benefitTag.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";

// 目的：カード表示用に「ご利益タグ」を1つだけ推定する（暫定ルール）
//
// 将来サーバーが wish_key / tags を返すようになったら、ここを置き換える。

export type BenefitKey = "縁結び" | "学業" | "金運" | "厄除" | "健康" | "仕事" | "開運" | "不明";

type Rule = { key: BenefitKey; re: RegExp };

// NOTE: 優先順位＝上から
const RULES: Rule[] = [
  { key: "縁結び", re: /(縁結び|恋愛|良縁|結婚|復縁|恋|出会い)/i },
  { key: "学業", re: /(学業|合格|受験|試験|勉強|資格)/i },
  { key: "金運", re: /(金運|財運|商売繁盛|商売|仕事運.*金|お金|収入)/i },
  { key: "厄除", re: /(厄除|厄払い|厄年|災難|方除|邪気|浄化)/i },
  { key: "健康", re: /(健康|病気平癒|長寿|安産|子授け)/i },
  { key: "仕事", re: /(仕事運|出世|勝運|必勝|開業|転職)/i },
  { key: "開運", re: /(開運|運気|幸運|招福|福徳)/i },
];

function toText(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * 候補データから「ご利益タグ」を1つ推定
 * - reason/name/display_name を優先して見る
 * - tags/deities/benefits が配列で来ていればそれも使う（将来互換）
 */
export function pickBenefitTag(input: {
  name?: unknown;
  display_name?: unknown;
  reason?: unknown;
  tags?: unknown;
  deities?: unknown;
  benefits?: unknown;
}): BenefitKey {
  const parts: string[] = [];

  parts.push(toText(input.display_name));
  parts.push(toText(input.name));
  parts.push(toText(input.reason));

  const pushArray = (x: unknown) => {
    if (Array.isArray(x)) {
      for (const it of x) parts.push(toText(it));
    }
  };
  pushArray(input.tags);
  pushArray(input.deities);
  pushArray(input.benefits);

  const text = parts.filter(Boolean).join(" ").trim();
  if (!text) return "不明";

  for (const r of RULES) {
    if (r.re.test(text)) return r.key;
  }
  return "不明";
}

/** 表示ラベル（不明は出さない想定） */
export function benefitLabel(key: BenefitKey): string | null {
  return key === "不明" ? null : key;
}

export function pickBenefitTagFromRec(
  r: Pick<ConciergeRecommendation, "name" | "display_name" | "reason" | "tags" | "deities"> & {
    benefits?: unknown;
  },
): BenefitKey {
  return pickBenefitTag({
    name: r?.name,
    display_name: r?.display_name,
    reason: r?.reason,
    tags: r?.tags,
    deities: r?.deities,
    benefits: r?.benefits,
  });
}
