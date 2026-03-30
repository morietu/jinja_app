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

// 登録済み=shrine_idあり → /shrines/:id, 未登録=place_idのみ → /shrines/resolve, どちらも無い→除外
function normalizeRecommendation(r: any, tid: string | null): NormalizedItem | null {
  const shrineId = asPositiveInt(r?.shrine_id ?? r?.shrine?.id ?? null);

  const placeId =
    asTrimmedString(r?.place_id) ??
    asTrimmedString(r?.placeId) ??
    (r?.place_id != null ? String(r.place_id).trim() : null) ??
    (r?.placeId != null ? String(r.placeId).trim() : null);

  const isDummy = r?.is_dummy === true || r?.__dummy === true;
  const rawHref = detailHrefFromRecommendation(r, { ctx: "concierge", tid: tid ?? undefined }) ?? undefined;
  const detailHref = isDummy ? undefined : rawHref;

  const title = pickFirstString(r?.display_name, r?.name) ?? "名称不明";
  const address = pickFirstString(r?.display_address, r?.address, r?.location);
  const description = pickFirstString(r?.reason) ?? "";
  const imageUrl = asTrimmedString(r?.photo_url);
  const breakdown = r?.breakdown ?? null;

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

  // placeId -> out index（registered only）
  const registeredByPlace = new Map<string, number>();

  // 1) registered を先に確保
  for (const item of items) {
    if (item.kind !== "registered") continue;

    if (seenShrine.has(item.shrineId)) continue;
    seenShrine.add(item.shrineId);

    out.push(item);

    // ★ push 後の index を保存
    if (item.placeId) {
      const k = norm(item.placeId);
      if (k) {
        seenPlace.add(k);
        registeredByPlace.set(k, out.length - 1);
      }
    }
  }

  // 2) place は後から
  for (const item of items) {
    if (item.kind !== "place") continue;

    const k = norm(item.placeId);
    if (!k) continue;

    if (seenPlace.has(k)) {
      // ★ breakdown だけ救出
      const idx = registeredByPlace.get(k);
      if (idx != null) {
        const reg = out[idx];
        if (
          reg?.kind === "registered" &&
          (reg.breakdown == null || typeof reg.breakdown !== "object") &&
          item.breakdown &&
          typeof item.breakdown === "object"
        ) {
          out[idx] = { ...reg, breakdown: item.breakdown };
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

  const reply =
    (typeof (u as any)?.reply === "string" ? (u as any).reply : null) ??
    (typeof metaObj?.reply === "string" ? metaObj.reply : null) ??
    null;

  const remaining =
    (typeof metaObj?.remaining === "number" ? metaObj.remaining : null) ??
    (typeof (u as any)?.remaining === "number" ? (u as any).remaining : null) ??
    null;

  const limitReached = metaObj?.limitReached === true || (u as any)?.limitReached === true;
  const tidRaw = (u as any)?.thread?.id ?? (u as any)?.thread_id ?? (u as any)?.data?.thread_id ?? null;
  const tid = tidRaw != null ? String(tidRaw) : null;

  const hasRecs = Array.isArray(recs) && recs.length > 0;
  const isLimitReached = limitReached;

  const mode = (u as any)?.data?._signals?.mode ?? null;
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
      meta: { mode, reply, remaining, limitReached, tid, resultState },
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

  return {
    version: 1,
    sections,
    meta: { mode, reply, remaining, limitReached, tid, resultState },
  };
}


export function __dedupeItemsForTest(items: NormalizedItem[]): NormalizedItem[] {
  return dedupeItems(items);
}
