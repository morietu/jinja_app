// apps/web/src/features/concierge/buildPayloadFromUnified.ts
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
} from "@/features/concierge/sections/types";

import { detailHrefFromRecommendation } from "@/features/concierge/detailHref";

type NormalizedItemBase = {
  title: string;
  address: string | null;
  description: string; // null禁止
  imageUrl: string | null;
  breakdown: any | null;
  detailHref?: string; // ない時は undefined（nullは使わない）
};

type NormalizedRegistered = NormalizedItemBase & {
  kind: "registered";
  shrineId: number;
  placeId?: string | null;
  goriyakuTags: string[];
  initialFav: boolean;
};

type NormalizedPlace = NormalizedItemBase & {
  kind: "place";
  placeId: string;
  detailLabel: string;
};

type NormalizedItem = NormalizedRegistered | NormalizedPlace;

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function pickFirstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = asTrimmedString(v);
    if (s) return s;
  }
  return null;
}

// 登録済み=shrine_idあり → /shrines/:id, 未登録=place_idのみ → /places/:placeId, どちらも無い→除外
function normalizeRecommendation(r: any, tid: string | null): NormalizedItem | null {
  const shrineId = asPositiveInt(r?.shrine_id ?? r?.shrine?.id ?? null);

  const placeId =
    asTrimmedString(r?.place_id) ??
    asTrimmedString(r?.placeId) ??
    (r?.place_id != null ? String(r.place_id).trim() : null) ??
    (r?.placeId != null ? String(r.placeId).trim() : null);

  // ✅ href生成はここだけ（P1）
  const detailHref = detailHrefFromRecommendation(r, { ctx: "concierge", tid }) ?? undefined;

  // DEBUG: これで現実を見る
  if (process.env.NEXT_PUBLIC_DEBUG_LOG === "1") {
    console.log("[concierge] rec ids", {
      shrineId,
      placeId,
      detailHref,
      raw_place_id: r?.place_id,
      raw_placeId: r?.placeId,
      keys: Object.keys(r ?? {}),
    });
  }

  const title = pickFirstString(r?.display_name, r?.name) ?? "名称不明";
  const address = pickFirstString(r?.display_address, r?.address, r?.location);
  const description = pickFirstString(r?.reason) ?? "";
  const imageUrl = asTrimmedString(r?.photo_url);
  const breakdown = r?.breakdown ?? null;

  // ✅ registered優先
  if (shrineId) {
    if (process.env.NEXT_PUBLIC_DEBUG_LOG === "1") {
      console.log("[concierge] normalized", { shrineId, placeId, detailHref, title });
    }
    return {
      kind: "registered",
      shrineId,
      placeId,
      title,
      address,
      description,
      imageUrl,
      breakdown,
      detailHref,
      goriyakuTags: [],
      initialFav: false,
    };
  }

  if (placeId) {
    if (process.env.NEXT_PUBLIC_DEBUG_LOG === "1") {
      console.log("[concierge] normalized(place)", { shrineId, placeId, detailHref, title });
    }
    return {
      kind: "place",
      placeId,
      title,
      address,
      description,
      imageUrl,
      breakdown,
      detailHref,
      detailLabel: "神社の詳細を見る",
    };
  }

  return null;
}

function dedupeItems(items: NormalizedItem[]): NormalizedItem[] {
  const out: NormalizedItem[] = [];
  const seenShrine = new Set<number>();
  const seenPlace = new Set<string>();
  const norm = (s: string) => s.trim().toLowerCase();

  // 1) registered を先に確保（混在したら registered 勝ちを保証）
  for (const item of items) {
    if (item.kind !== "registered") continue;

    if (seenShrine.has(item.shrineId)) continue;
    seenShrine.add(item.shrineId);

    if (item.placeId) {
      const k = norm(item.placeId);
      if (k) seenPlace.add(k);
    }

    out.push(item);
  }

  // 2) place は後から（registered に同placeIdがいたら落ちる）
  for (const item of items) {
    if (item.kind !== "place") continue;

    const k = norm(item.placeId);
    if (!k) continue;
    if (seenPlace.has(k)) continue;

    seenPlace.add(k);
    out.push(item);
  }

  return out;
}

export function buildPayloadFromUnified(
  u: UnifiedConciergeResponse | null,
  filterState: ConciergeFilterState,
): ConciergeSectionsPayload | null {
  const recs = u?.data?.recommendations;

  // ✅ meta の場所が揺れてる前提で吸収する
  const metaObj = (u as any)?.meta ?? null;

  const note =
    (typeof metaObj?.note === "string" ? metaObj.note : null) ??
    (typeof (u as any)?.note === "string" ? (u as any).note : null) ??
    null;

  const reply =
    (typeof (u as any)?.reply === "string" ? (u as any).reply : null) ??
    (typeof metaObj?.reply === "string" ? metaObj.reply : null) ??
    null;

  const remainingFree =
    (typeof metaObj?.remainingFree === "number" ? metaObj.remainingFree : null) ??
    (typeof metaObj?.remaining_free === "number" ? metaObj.remaining_free : null) ??
    (typeof (u as any)?.remaining_free === "number" ? (u as any).remaining_free : null) ??
    (typeof (u as any)?.remainingFree === "number" ? (u as any).remainingFree : null) ??
    null;

  const tidRaw = (u as any)?.thread?.id ?? (u as any)?.thread_id ?? (u as any)?.data?.thread_id ?? null;
  const tid = tidRaw != null ? String(tidRaw) : null;

  const hasRecs = Array.isArray(recs) && recs.length > 0;
  const isLimitReached = note === "limit-reached" || remainingFree === 0;

  const mode = (u as any)?.data?._signals?.mode ?? null;

  // ✅ recommendations が無いが理由はある → payload 返す
  if (!hasRecs && (reply || isLimitReached)) {
    const sections: ConciergeSection[] = [
      {
        type: "filter",
        title: "条件を追加",
        closedLabel: "条件を追加",
        state: filterState,
      },
      {
        type: "actions",
        items: [
          { action: "add_condition", label: "条件を追加" },
          { action: "open_map", label: "地図で近くの神社を見る" },
        ],
      },
    ];

    return {
      version: 1,
      sections,
      meta: { mode, note, reply, remainingFree, tid },
    };
  }

  if (!hasRecs) return null;

  let items = recs.map((r: any) => normalizeRecommendation(r, tid)).filter((x): x is NormalizedItem => x !== null);

  items = dedupeItems(items);

  if (items.length === 0) return null;

  const sections: ConciergeSection[] = [
    {
      type: "filter",
      title: "条件を追加",
      closedLabel: "条件を追加",
      state: filterState,
    },
    { type: "recommendations", title: "候補", items: items as any[] },
    {
      type: "actions",
      items: [
        { action: "add_condition", label: "条件を追加" },
        { action: "open_map", label: "地図で近くの神社を見る" },
      ],
    },
  ];

  const astroRaw = (u as any)?.data?._signals?.astro ?? (u as any)?.data?._astro ?? null;
  const astro = astroRaw && typeof astroRaw === "object" ? astroRaw : null;

  if (astro && (astro.label_ja || astro.element || astro.reason || astro.sun_sign)) {
    const idx = sections.findIndex((s) => s.type === "recommendations");
    const insertAt = idx >= 0 ? idx : 2;

    sections.splice(insertAt, 0, {
      type: "astro",
      title: "占星術フィルター",
      sunSign: typeof astro.sun_sign === "string" ? astro.sun_sign : undefined,
      element: String(astro.label_ja ?? astro.element ?? ""),
      elementCode: typeof astro.element_code === "string" ? astro.element_code : undefined,
      reason: typeof astro.reason === "string" ? astro.reason : undefined,
    });
  }

  // ✅ hasRecs のときも meta を揃える（UIが metaReply / limit を参照しても死なない）
  return {
    version: 1,
    sections,
    meta: { mode, note, reply, remainingFree, tid },
  };
}

export function __dedupeItemsForTest(items: NormalizedItem[]): NormalizedItem[] {
  return dedupeItems(items);
}
