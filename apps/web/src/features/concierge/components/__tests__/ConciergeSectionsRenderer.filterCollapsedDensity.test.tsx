import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// docs/product/recommendation-result-information-architecture.md §3 Finding 1
// follow-up, §15 PR1: the collapsed filter state must act as an entry point only
// (a single "add/change condition" affordance), not an inline input UI. Real input
// controls (apply, back-to-entry, 参拝Preference preset) live in the open
// ConciergeFilterPanel state. This file locks that contract down, separately from
// the pre-existing behavior tests in ConciergeSectionsRenderer.coverage.test.tsx.
//
// 参拝Preferenceの入力UIは ConciergeFilterPanel が正本で、Renderer側の独立
// Quick Preset（短縮ラベル「静か」「駅近」等）は廃止した。その契約自体は
// ConciergeSectionsRenderer.presetUnification.test.tsx が担保する。

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({ isLoggedIn: false, loading: false })),
}));
vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: authMock.useAuth }));
vi.mock("@/lib/analytics/searchEvents", () => ({ trackSearchEvent: vi.fn() }));
vi.mock("@/lib/analytics/cardEvents", () => ({ trackCardEvent: vi.fn() }));

import ConciergeSectionsRenderer from "../ConciergeSectionsRenderer";
import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";

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
  visitPreferences: [],
  plannedVisitDate: "",
  userOrigin: null,
};

const heroRec = {
  shrine_id: 1,
  display_name: "第一候補神社",
  reason: "理由文",
};

function buildTestPayload(filterState: any) {
  const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
  const payload = buildPayloadFromUnified(u, filterState);
  if (!payload) throw new Error("payload should not be null in this fixture");
  return payload;
}

describe("Collapsed filter density (default collapsed contract)", () => {
  it("1. filter未指定 + initial result: collapsedはtitle + 単一の入口ボタンのみ", () => {
    const payload = buildTestPayload(baseFilterState);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute={false} />);

    expect(screen.getByText("補助条件を添える")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう少し詳しく添える" })).toBeInTheDocument();

    // Real input controls must not be reachable while collapsed.
    expect(screen.queryByRole("button", { name: "静か" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "駅近" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ひとり" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "階段少なめ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "入口に戻る" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "この内容で反映する" })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it("2. filter指定済み + result: collapsedでも同じ最小構成のまま（appliedLabelは既存の別blockが担う、重複表示しない）", () => {
    const payload = buildTestPayload({ ...baseFilterState, extraCondition: "静か" });
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute={false} />);

    // "条件: 静か" appears exactly once (the pre-existing appliedLabel chip near the
    // results section), not duplicated inside the collapsed filter entry point.
    expect(screen.getAllByText("条件: 静か")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "もう少し詳しく添える" })).toBeInTheDocument();
  });

  it("3. collapsed -> open: 「もう少し詳しく添える」がadd_conditionを発火する", () => {
    const onAction = vi.fn();
    const payload = buildTestPayload(baseFilterState);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} isEntryRoute={false} />);

    fireEvent.click(screen.getByRole("button", { name: "もう少し詳しく添える" }));
    expect(onAction).toHaveBeenCalledWith({ type: "add_condition" });
  });

  it("4. open -> collapsed: 「閉じる」がfilter_closeを発火する", () => {
    const onAction = vi.fn();
    const payload = buildTestPayload({ ...baseFilterState, isOpen: true });
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} isEntryRoute={false} />);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onAction).toHaveBeenCalledWith({ type: "filter_close" });
  });

  it("5. close/reopenでinput値が保持される（親stateのpayload再構築を模した再render）", () => {
    const onAction = vi.fn();
    const openState = {
      ...baseFilterState,
      isOpen: true,
      birthdate: "1990-05-20",
      extraCondition: "駅近",
    };

    // 保持の観測点:
    //   birthdate    -> ConciergeFilterPanel の date input の value
    //   extraCondition -> 結果近くの appliedLabel チップ「条件: 駅近」
    // （以前は Renderer 側の独立Quick Presetチップの活性状態を見ていたが、
    //   そのUIは ConciergeFilterPanel へ一本化して廃止したため観測点を移した。
    //   ConciergeFilterPanel は extraCondition の自由入力欄を持たない。）
    const { rerender } = render(
      <ConciergeSectionsRenderer payload={buildTestPayload(openState)} threadId={1} onAction={onAction} isEntryRoute={false} />,
    );
    expect((document.querySelector('input[type="date"]') as HTMLInputElement).value).toBe("1990-05-20");
    expect(screen.getByText("条件: 駅近")).toBeInTheDocument();

    // Close: only the parent's isOpen flag flips, the rest of filterState is untouched
    // (mirrors how ConciergeClientFull's filter_close handler only calls
    // setIsFilterOpen(false), never resets extraCondition/birthdate/etc).
    const closedState = { ...openState, isOpen: false };
    rerender(<ConciergeSectionsRenderer payload={buildTestPayload(closedState)} threadId={1} onAction={onAction} isEntryRoute={false} />);
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByText("条件: 駅近")).toBeInTheDocument();

    // Reopen: the same values must still be there, not reset.
    rerender(<ConciergeSectionsRenderer payload={buildTestPayload(openState)} threadId={1} onAction={onAction} isEntryRoute={false} />);
    expect((document.querySelector('input[type="date"]') as HTMLInputElement).value).toBe("1990-05-20");
    expect(screen.getByText("条件: 駅近")).toBeInTheDocument();
  });

  it("6. 再Recommendation後(fallback候補)でもcollapsed contractを維持する", () => {
    const u: any = {
      data: { recommendations: [{ ...heroRec, is_dummy: true }] },
      thread: { id: 1 },
    };
    const payload = buildPayloadFromUnified(u, baseFilterState)!;
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute={false} />);

    expect(screen.getByRole("button", { name: "もう少し詳しく添える" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "静か" })).not.toBeInTheDocument();
  });

  it("7. authenticated/anonymousどちらでもcollapsed contractは崩れない", () => {
    authMock.useAuth.mockReturnValueOnce({ isLoggedIn: true, loading: false });
    const payload = buildTestPayload(baseFilterState);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute={false} />);

    expect(screen.getByRole("button", { name: "もう少し詳しく添える" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "静か" })).not.toBeInTheDocument();
  });
});
