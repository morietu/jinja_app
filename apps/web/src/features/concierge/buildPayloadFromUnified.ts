// apps/web/src/features/concierge/buildPayloadFromUnified.ts
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
} from "@/features/concierge/sections/types";

import { detailHrefFromRecommendation } from "@/features/concierge/detailHref";

type NormalizedExplanation = {
  version?: number | null;
  summary?: string | null;
  reasons?: Array<{
    code?: string | null;
    label?: string | null;
    text?: string | null;
    strength?: "low" | "mid" | "high" | null;
    evidence?: Record<string, unknown> | null;
  }> | null;
  disclaimer?: string | null;
} | null;

type NormalizedItemBase = {
  title: string;
  address: string | null;
  description: string;
  imageUrl: string | null;
  breakdown: any | null;
  explanation?: NormalizedExplanation;
  compatSummary?: string | null;
  compatReason?: string | null;
  detailHref?: string;
  isDummy?: boolean;
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

function pickCompatSummary(r: any): string | null {
  const astro = r?._signals?.astro ?? r?._astro ?? null;
  if (astro && typeof astro === "object") {
    if (typeof astro.label_ja === "string" && astro.label_ja.trim()) {
      return `${astro.label_ja}の性質と重なる相性`;
    }
    if (typeof astro.element === "string" && astro.element.trim()) {
      return `${astro.element}の性質と重なる相性`;
    }
  }

  const elementScore = r?.breakdown?.score_element;
  if (typeof elementScore === "number" && elementScore >= 1) {
    return "誕生日由来の相性も踏まえた候補";
  }

  return null;
}

function pickCompatReason(r: any): string | null {
  const astro = r?._signals?.astro ?? r?._astro ?? null;
  if (astro && typeof astro === "object") {
    return typeof astro.reason === "string" ? astro.reason : null;
  }

  const elementScore = r?.breakdown?.score_element;
  if (typeof elementScore === "number" && elementScore >= 1) {
    return "誕生日由来の相性要素も踏まえて選ばれています。";
  }

  return null;
}

function normalizeRecommendation(
  r: any,
  tid: string | null,
  responseMode: "need" | "compat" | null,
): NormalizedItem | null {
  const shrineId = asPositiveInt(r?.shrine_id ?? r?.shrine?.id ?? null);

  const placeId =
    asTrimmedString(r?.place_id) ??
    asTrimmedString(r?.placeId) ??
    (r?.place_id != null ? String(r.place_id).trim() : null) ??
    (r?.placeId != null ? String(r.placeId).trim() : null);

  const isDummy = r?.is_dummy === true || r?.__dummy === true;

  const rawHref =
    detailHrefFromRecommendation(r, {
      ctx: "concierge",
      tid: tid ?? undefined,
    }) ?? undefined;

  const detailHref = isDummy ? undefined : rawHref;

  const compatSummary = responseMode === "compat" ? pickCompatSummary(r) : null;
  const compatReason = responseMode === "compat" ? pickCompatReason(r) : null;

  const title = pickFirstString(r?.display_name, r?.name) ?? "名称不明";
  const address = pickFirstString(r?.display_address, r?.address, r?.location);
  const description = pickFirstString(r?.reason) ?? "";
  const imageUrl = asTrimmedString(r?.photo_url);
  const breakdown = r?.breakdown ?? null;
  const explanation = r?.explanation && typeof r.explanation === "object" ? r.explanation : null;

  if (shrineId) {
    return {
      kind: "registered",
      shrineId,
      placeId,
      title,
      address,
      description,
      imageUrl,
      breakdown,
      explanation,
      compatSummary,
      compatReason,
      detailHref,
      isDummy,
      goriyakuTags: [],
      initialFav: false,
    };
  }

  if (placeId) {
    return {
      kind: "place",
      placeId,
      title,
      address,
      description,
      imageUrl,
      breakdown,
      explanation,
      compatSummary,
      compatReason,
      detailHref,
      isDummy,
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
  const registeredByPlace = new Map<string, number>();

  for (const item of items) {
    if (item.kind !== "registered") continue;
    if (seenShrine.has(item.shrineId)) continue;

    seenShrine.add(item.shrineId);
    out.push(item);

    if (item.placeId) {
      const k = norm(item.placeId);
      if (k) {
        seenPlace.add(k);
        registeredByPlace.set(k, out.length - 1);
      }
    }
  }

  for (const item of items) {
    if (item.kind !== "place") continue;

    const k = norm(item.placeId);
    if (!k) continue;

    if (seenPlace.has(k)) {
      const idx = registeredByPlace.get(k);
      if (idx != null) {
        const reg = out[idx];
        if (reg?.kind === "registered") {
          out[idx] = {
            ...reg,
            breakdown:
              reg.breakdown == null || typeof reg.breakdown !== "object"
                ? (item.breakdown ?? reg.breakdown)
                : reg.breakdown,
            explanation:
              reg.explanation == null || typeof reg.explanation !== "object"
                ? (item.explanation ?? reg.explanation)
                : reg.explanation,
            compatSummary:
              reg.compatSummary == null || !String(reg.compatSummary).trim()
                ? (item.compatSummary ?? reg.compatSummary)
                : reg.compatSummary,
            compatReason:
              reg.compatReason == null || !String(reg.compatReason).trim()
                ? (item.compatReason ?? reg.compatReason)
                : reg.compatReason,
          };
        }
      }
      continue;
    }

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

  const responseMode = mode?.mode === "compat" ? "compat" : mode?.mode === "need" ? "need" : null;
  const rsRaw = (u as any)?.data?._signals?.result_state ?? (u as any)?.data?._signals?.resultState ?? null;

  const resultState =
    rsRaw && typeof rsRaw === "object"
      ? {
          matched_count: typeof rsRaw.matched_count === "number" ? rsRaw.matched_count : undefined,
          fallback_mode: typeof rsRaw.fallback_mode === "string" ? rsRaw.fallback_mode : "none",
          fallback_reason_ja: typeof rsRaw.fallback_reason_ja === "string" ? rsRaw.fallback_reason_ja : null,
          ui_disclaimer_ja: typeof rsRaw.ui_disclaimer_ja === "string" ? rsRaw.ui_disclaimer_ja : null,
          requested_extra_condition:
            typeof rsRaw.requested_extra_condition === "string" ? rsRaw.requested_extra_condition : null,
        }
      : null;

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
      meta: { mode, note, reply, remainingFree, tid, resultState },
    };
  }

  if (!hasRecs) return null;

  let items = recs
    .map((r: any) => normalizeRecommendation(r, tid, responseMode))
    .filter((x): x is NormalizedItem => x !== null);

  items = dedupeItems(items);

  if (items.length === 0) return null;

  const astroRaw = (u as any)?.data?._signals?.astro ?? (u as any)?.data?._astro ?? null;
  const astro = astroRaw && typeof astroRaw === "object" ? astroRaw : null;

  if (responseMode === "compat" && astro) {
    items = items.map((item) => {
      if (item.kind !== "registered") return item;

      const compatSummary =
        item.compatSummary ??
        (typeof astro.label_ja === "string" && astro.label_ja.trim()
          ? `${astro.label_ja}の性質と重なる相性`
          : typeof astro.element === "string" && astro.element.trim()
            ? `${astro.element}の性質と重なる相性`
            : null);

      const compatReason =
        item.compatReason ?? (typeof astro.reason === "string" && astro.reason.trim() ? astro.reason : null);

      return {
        ...item,
        compatSummary,
        compatReason,
      };
    });
  }



  const sections: ConciergeSection[] = [
    {
      type: "filter",
      title: "条件を追加",
      closedLabel: "条件を追加",
      state: filterState,
    },
    {
      type: "recommendations",
      title: "候補",
      items: items as any[],
    },
    {
      type: "actions",
      items: [
        { action: "add_condition", label: "条件を追加" },
        { action: "open_map", label: "地図で近くの神社を見る" },
      ],
    },
  ];

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

  return {
    version: 1,
    sections,
    meta: { mode, note, reply, remainingFree, tid, resultState },
  };
}

export function __dedupeItemsForTest(items: NormalizedItem[]): NormalizedItem[] {
  return dedupeItems(items);
}
