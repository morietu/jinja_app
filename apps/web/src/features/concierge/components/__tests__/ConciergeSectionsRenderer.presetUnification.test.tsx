// 参拝Preference入力UIの一本化契約。
//
// 以前は ConciergeSectionsRenderer 自身が短縮ラベルの独立Quick Preset
// (「静か」「駅近」「ひとり」「階段少なめ」) を持ち、ConciergeFilterPanel の
// QUICK_PRESET_GROUPS と二系統が並立していた。同じ意図に対して別のSignalが
// 飛ぶため、入力UIは ConciergeFilterPanel を正本として一本化した。
//
// このファイルは「Renderer側に独立Presetが無い」ことだけを固定する。
// FilterPanel側Presetの挙動（extraCondition + canonical tagの送出）は
// ConciergeFilterPanel.visitPreference.test.tsx と
// ConciergeSectionsRenderer.coverage.test.tsx が既に担保しているため、
// ここでは重複させない。
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({ isLoggedIn: false, loading: false })),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: authMock.useAuth,
}));

vi.mock("@/lib/analytics/searchEvents", () => ({ trackSearchEvent: vi.fn() }));
vi.mock("@/lib/analytics/cardEvents", () => ({ trackCardEvent: vi.fn() }));

import ConciergeSectionsRenderer from "../ConciergeSectionsRenderer";
import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";

const baseFilterState: any = {
  isOpen: true,
  birthdate: "",
  element4: null,
  goriyakuTags: [],
  suggestedTags: [],
  selectedTagIds: [],
  tagsLoading: false,
  tagsError: null,
  extraCondition: "",
  visitPreferences: [],
  plannedVisitDate: "",
  userOrigin: null,
};

const heroRec = {
  shrine_id: 1,
  display_name: "第一候補神社",
  reason: "第一候補の理由文です。",
};

/** 削除した独立Quick Presetの短縮ラベル。 */
const REMOVED_SHORT_PRESETS = ["静か", "駅近", "ひとり", "階段少なめ"] as const;

function renderOpen(filterState: any = baseFilterState) {
  const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
  const payload = buildPayloadFromUnified(u, filterState);
  if (!payload) throw new Error("payload should not be null in this fixture");
  render(<ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute={false} />);
}

describe("参拝Preference入力UIはConciergeFilterPanelに一本化されている", () => {
  it("開いた状態でも短縮ラベルの独立Quick Presetを描画しない", () => {
    renderOpen();

    // 完全一致で引く。FilterPanel側の「静かな時間を過ごしたい」等は
    // accessible nameが異なるため、ここでは一致しない。
    for (const label of REMOVED_SHORT_PRESETS) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
  });

  it("独立Quick Presetに付随していた見出し・サマリも残っていない", () => {
    renderOpen({ ...baseFilterState, extraCondition: "静か 駅近" });

    expect(screen.queryByText("必要なものだけ選んでください")).not.toBeInTheDocument();
    expect(screen.queryByText(/^追加済み:/)).not.toBeInTheDocument();
  });

  it("正本であるConciergeFilterPanelのPresetは開いた状態で提供される", () => {
    renderOpen();

    expect(screen.getByRole("button", { name: "静かな時間を過ごしたい" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アクセスしやすい場所がいい" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "人混みを避けたい" })).toBeInTheDocument();
  });

  it("free-text由来のextraConditionは引き続き「条件:」チップに表示される（互換維持）", () => {
    // ユーザーが自由入力した「ひとり」はPresetから外れてもSignalとして生き続ける
    // （解釈は ConciergeClientFull.tsx / hooks.ts のfree-text互換処理が担当）。
    renderOpen({ ...baseFilterState, extraCondition: "ひとり" });

    expect(screen.getByText("条件: ひとり")).toBeInTheDocument();
  });
});
