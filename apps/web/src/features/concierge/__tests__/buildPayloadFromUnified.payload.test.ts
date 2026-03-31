import { describe, it, expect } from "vitest";
import { buildPayloadFromUnified } from "../buildPayloadFromUnified";

const baseFilterState: any = {
  isOpen: false,
  birthdate: "",
  element4: null,
  goriyakuTags: [],
  suggestedTags: [],
  selectedTagIds: [],
  tagsLoading: false,
  tagsError: null,
  extraCondition: "",
};

describe("buildPayloadFromUnified (payload/meta/astro)", () => {
  it("recs無しでも reply があれば payload を返す（filter/actions + meta）", () => {
    const u: any = {
      reply: "候補が見つかりませんでした",
      data: { recommendations: [] },
      thread: { id: 123 },
    };

    const p = buildPayloadFromUnified(u, baseFilterState);
    expect(p).not.toBeNull();
    expect(p?.sections?.some((s: any) => s.type === "filter")).toBe(true);
    expect(p?.sections?.some((s: any) => s.type === "actions")).toBe(true);
    expect(p?.meta?.reply).toBe("候補が見つかりませんでした");
    expect(p?.meta?.tid).toBe("123");
  });

  it("recs無しでも limitReached=true なら limit として payload を返す", () => {
    const u: any = {
      limitReached: true,
      remaining: 0,
      data: { recommendations: [] },
      thread_id: 9,
    };

    const p = buildPayloadFromUnified(u, baseFilterState);
    expect(p).not.toBeNull();
    expect(p?.meta?.limitReached).toBe(true);
    expect(p?.meta?.remaining).toBe(0);
    expect(p?.meta?.tid).toBe("9");
  });

  it("recsありなら recommendations セクションを返す（meta も揃う）", () => {
    const u: any = {
      meta: { reply: "どうぞ" },
      data: {
        recommendations: [
          { shrine_id: 10, place_id: "P10", display_name: "S1", reason: "R1" },
          { place_id: "P11", display_name: "S2", reason: "R2" },
        ],
      },
      thread: { id: 1 },
    };

    const p = buildPayloadFromUnified(u, baseFilterState);
    expect(p).not.toBeNull();

    const recSec = p?.sections?.find((s: any) => s.type === "recommendations");
    expect(recSec).toBeTruthy();
    expect(Array.isArray((recSec as any).items)).toBe(true);

    expect(p?.meta?.reply).toBe("どうぞ");
    expect(p?.meta?.tid).toBe("1");
  });

  it("astro があれば astro セクションを recommendations の前に挿入する", () => {
    const u: any = {
      data: {
        _signals: {
          astro: { label_ja: "火", sun_sign: "牡羊座", reason: "テスト" },
          mode: "B",
        },
        recommendations: [{ place_id: "P1", name: "A", reason: "R" }],
      },
      thread: { id: 77 },
    };

    const p = buildPayloadFromUnified(u, baseFilterState);
    expect(p).not.toBeNull();

    const types = (p?.sections ?? []).map((s: any) => s.type);
    const astroIdx = types.indexOf("astro");
    const recIdx = types.indexOf("recommendations");
    expect(astroIdx).toBeGreaterThanOrEqual(0);
    expect(recIdx).toBeGreaterThanOrEqual(0);
    expect(astroIdx).toBeLessThan(recIdx);

    expect(p?.meta?.mode).toBe("B");
  });

  it("meta の揺れ: reply / remaining / limitReached を u 側からも拾える", () => {
    const u: any = {
      remaining: 0,
      limitReached: true,
      reply: "上限です",
      data: { recommendations: [] },
      thread_id: 555,
    };

    const p = buildPayloadFromUnified(u, baseFilterState);
    expect(p).not.toBeNull();
    expect(p?.meta?.remaining).toBe(0);
    expect(p?.meta?.limitReached).toBe(true);
    expect(p?.meta?.reply).toBe("上限です");
    expect(p?.meta?.tid).toBe("555");
  });
});

it("reason_facts を recommendation item に通す", () => {
  const u: any = {
    data: {
      recommendations: [
        {
          shrine_id: 10,
          display_name: "S1",
          reason: "R1",
          reason_facts: {
            version: 1,
            primary_axis: "need",
            matched_need_tags: ["厄除け"],
            shrine_feature: "静かに歩ける",
          },
        },
      ],
    },
    thread: { id: 1 },
  };

  const p = buildPayloadFromUnified(u, baseFilterState);
  const recSec = p?.sections.find((s: any) => s.type === "recommendations") as any;
  expect(recSec.items[0].reasonFacts).toEqual(
    expect.objectContaining({
      primary_axis: "need",
      matched_need_tags: ["厄除け"],
    }),
  );
});
