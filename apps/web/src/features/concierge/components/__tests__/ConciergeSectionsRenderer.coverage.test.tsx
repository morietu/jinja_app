import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = vi.hoisted(() => ({
  trackSearchEvent: vi.fn(),
  trackCardEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/searchEvents", () => ({
  trackSearchEvent: analyticsMocks.trackSearchEvent,
}));

vi.mock("@/lib/analytics/cardEvents", () => ({
  trackCardEvent: analyticsMocks.trackCardEvent,
}));

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({ isLoggedIn: false, loading: false })),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: authMock.useAuth,
}));

import ConciergeSectionsRenderer from "../ConciergeSectionsRenderer";
import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";

const baseFilterState: any = {
  isOpen: false,
  birthdate: "",
  element4: null,
  goriyakuTags: [{ id: 1, name: "健康" }],
  suggestedTags: [],
  selectedTagIds: [],
  tagsLoading: false,
  tagsError: null,
  extraCondition: "",
  visitPreferences: [],
  plannedVisitDate: "",
  userOrigin: null,
};

function buildTestPayload(u: any, filterState = baseFilterState) {
  const payload = buildPayloadFromUnified(u, filterState);
  if (!payload) throw new Error("payload should not be null in this fixture");
  return payload;
}

const heroRec = {
  shrine_id: 1,
  display_name: "第一候補神社",
  reason: "第一候補の理由文です。",
  address: "東京都千代田区1-1-1",
  trust_metadata: {
    rank_class: "由緒あり",
    cultural_status: ["重要文化財"],
    lineage: "式内社",
    origin_summary: "古くから信仰を集める神社です。",
  },
};

describe("ConciergeSectionsRenderer - 既存経路のCoverage補完", () => {
  beforeEach(() => {
    analyticsMocks.trackSearchEvent.mockClear();
    analyticsMocks.trackCardEvent.mockClear();
    authMock.useAuth.mockReturnValue({ isLoggedIn: false, loading: false });
    window.localStorage.clear();
  });

  it("hasDummyの場合、近くの神社を見る/条件を広げて見直すボタンが表示・クリックできる", () => {
    const u: any = {
      data: {
        recommendations: [{ ...heroRec, is_dummy: true }],
      },
      thread: { id: 1 },
    };
    const payload = buildTestPayload(u);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={vi.fn()} />);

    const openMap = screen.getByRole("button", { name: "近くの神社を静かに見る" });
    const widen = screen.getByRole("button", { name: "条件を広げて見直す" });
    fireEvent.click(openMap);
    fireEvent.click(widen);

    expect(
      screen.getByText("条件に合う神社が少ないため、まずは向かいやすい神社から表示しています。"),
    ).toBeInTheDocument();
  });

  it("appliedLabelが表示され、クリアボタンがfilter_clearを発火する", () => {
    const onAction = vi.fn();
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u, { ...baseFilterState, extraCondition: "静か" });
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} />);

    expect(screen.getByText("条件: 静か")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));
    expect(onAction).toHaveBeenCalledWith({ type: "filter_clear" });
  });

  it("補助条件(閉じた状態)は入口のみで、詳しく添えるボタンでadd_conditionが発火する（docs/product/recommendation-result-information-architecture.md §15 PR1）", () => {
    const onAction = vi.fn();
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u, { ...baseFilterState, extraCondition: "駅近" });
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} isEntryRoute={false} />);

    // apply / back-to-entry / 参拝Preference presetは開いた状態にのみ存在する
    // （次のテスト参照）。短縮ラベルの独立Quick Presetはどちらの状態でも持たない。
    expect(screen.queryByRole("button", { name: "静か" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "入口に戻る" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "この内容で反映する" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "もう少し詳しく添える" }));
    expect(onAction).toHaveBeenCalledWith({ type: "add_condition" });
  });

  it("補助条件(開いた状態)のConciergeFilterPanel操作・クイックプリセット・入口に戻るがonActionを発火する", () => {
    const onAction = vi.fn();
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u, { ...baseFilterState, isOpen: true, extraCondition: "静か" });
    render(
      <ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} isEntryRoute={false} canApply />,
    );

    fireEvent.click(screen.getByRole("button", { name: "健康" }));
    expect(onAction).toHaveBeenCalledWith({ type: "filter_toggle_tag", tagId: 1 });

    const birthdateInput = screen.getByLabelText("誕生日");
    fireEvent.change(birthdateInput, { target: { value: "1990-01-01" } });
    expect(onAction).toHaveBeenCalledWith({ type: "filter_set_birthdate", birthdate: "1990-01-01" });

    expect(screen.queryByRole("button", { name: "キャンセル" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "閉じる" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onAction).toHaveBeenCalledWith({ type: "filter_close" });
    expect(onAction).not.toHaveBeenCalledWith({ type: "filter_apply" });

    fireEvent.click(screen.getByRole("button", { name: "静かな時間を過ごしたい" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: "filter_set_extra" }));

    const plannedVisitDateInput = screen.getByLabelText("参拝予定日");
    fireEvent.change(plannedVisitDateInput, { target: { value: "2030-01-02" } });
    expect(onAction).toHaveBeenCalledWith({ type: "filter_set_visit_date", plannedVisitDate: "2030-01-02" });

    fireEvent.click(screen.getByRole("radio", { name: "方位情報を使用しない" }));
    expect(onAction).toHaveBeenCalledWith({ type: "filter_set_origin", userOrigin: null });

    fireEvent.click(screen.getByRole("radio", { name: "現在地を使用" }));
    expect(onAction).toHaveBeenCalledWith({ type: "filter_use_current_location" });

    fireEvent.click(screen.getByRole("button", { name: "この条件で提案を更新" }));
    expect(onAction).toHaveBeenCalledWith({ type: "filter_apply" });

    // 参拝PreferenceのStructured Signalは上の「静かな時間を過ごしたい」= 正本
    // ConciergeFilterPanel のPresetが担う。Renderer側の独立Quick Preset
    // （短縮ラベル「駅近」等）は廃止したためここでは操作しない。
    // canonical tagの送出内容自体は ConciergeFilterPanel.visitPreference.test.tsx
    // が網羅しているため重複させない。
    fireEvent.click(screen.getByRole("button", { name: "入口に戻る" }));
    expect(onAction).toHaveBeenCalledWith({ type: "back_to_entry" });
  });

  it("open editorはL2 → L3-A → L3-B → L3-Cの順で表示し、Apply labelをcontext別にする", () => {
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u, { ...baseFilterState, isOpen: true });
    const { container, rerender } = render(
      <ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute onAction={vi.fn()} />,
    );

    const sections = [
      screen.getByRole("region", { name: "今回の参拝の希望（任意）" }),
      screen.getByRole("region", { name: "誕生日（任意）" }),
      screen.getByRole("region", { name: "ご利益を指定する" }),
      screen.getByRole("region", { name: "参拝の詳細（任意）" }),
    ];
    for (let i = 0; i < sections.length - 1; i += 1) {
      expect(sections[i].compareDocumentPosition(sections[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "この条件で提案を見る" })).toBeDisabled();

    rerender(<ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute canApply onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "この条件で提案を見る" })).toBeEnabled();
    rerender(
      <ConciergeSectionsRenderer payload={payload} threadId={1} isEntryRoute={false} onAction={vi.fn()} canApply />,
    );
    expect(screen.getByRole("button", { name: "この条件で提案を更新" })).toBeEnabled();
    expect(container).toBeInTheDocument();
  });

  it("補助条件(開いた状態)ではConciergeFilterPanelのタイトルが重複表示されない(Concierge Entry Responsive/Density Polish)", () => {
    const onAction = vi.fn();
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u, { ...baseFilterState, isOpen: true });
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} />);

    // ConciergeFilterPanel renders its own title + close header as a
    // self-contained section; the outer DetailSection wrapper that used
    // to duplicate the same title text was removed. Guards against that
    // regression coming back. (buildPayloadFromUnified sets this filter
    // section's title to "条件を追加".)
    expect(screen.getAllByText("条件を追加")).toHaveLength(1);
  });

  it("window custom event concierge:open-filterでadd_conditionが発火する", () => {
    const onAction = vi.fn();
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} />);

    window.dispatchEvent(new Event("concierge:open-filter"));
    expect(onAction).toHaveBeenCalledWith({ type: "add_condition" });
  });

  it("free会員ではpremium_previewが表示され、クリックでpremium_preview_clickが送信される", () => {
    authMock.useAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} isPremiumActive={false} />);

    const cta = screen.getByRole("link", { name: "この神社を選ぶ意味を深掘りする" });
    fireEvent.click(cta);

    expect(analyticsMocks.trackCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "premium_preview_click", cardId: "premium_preview" }),
    );
    // PR-G2 follow-up: the single seam carries the allowed per-card teasers
    // (shrine_meaning / action_meaning) -- the same approved strings the
    // standalone teaser sections used before -- so a "teaser" visibility maps
    // to real teaser content. CTA-A responsibility stays Meaning Depth.
    const seam = screen.getByTestId("recommendation-premium-preview");
    expect(seam).toHaveTextContent("この神社が選ばれた深い理由は、Premiumで読めます。");
    expect(seam).toHaveTextContent("参拝で意識することの意味づけは、Premiumで読めます。");
  });

  it("Heroのtrust_metadataと詳細リンクのクリックが機能する", () => {
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} isPremiumActive={true} />);

    expect(screen.getByText("由緒あり")).toBeInTheDocument();
    expect(screen.getByText("古くから信仰を集める神社です。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "神社の詳細を見る" }));
    expect(analyticsMocks.trackSearchEvent).toHaveBeenCalledWith(
      "shrine_detail_transition",
      expect.objectContaining({ position: "hero_primary", shrineId: 1 }),
    );
  });

  it("未登録候補(place)はPlaceShrineCardとして表示される", () => {
    const u: any = {
      data: {
        recommendations: [
          heroRec,
          {
            place_id: "place-1",
            display_name: "未登録神社",
            reason: "未登録の理由",
            address: "東京都港区1-1-1",
          },
        ],
      },
      thread: { id: 1 },
    };
    const payload = buildTestPayload(u);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} />);

    expect(screen.getByText("未登録神社")).toBeInTheDocument();
    expect(screen.getByText("未登録")).toBeInTheDocument();
  });

  it("save_promptボタンがクリックでsave_concierge_threadを発火する", () => {
    const onAction = vi.fn();
    const u: any = { data: { recommendations: [heroRec] }, thread: { id: 1 } };
    const payload = buildTestPayload(u);
    render(<ConciergeSectionsRenderer payload={payload} threadId={1} onAction={onAction} />);

    const saveButtons = screen.getAllByRole("button", { name: "ログインしてあとで見返す" });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    expect(analyticsMocks.trackCardEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "save_prompt_click", cardId: "save_prompt" }),
    );
    expect(onAction).toHaveBeenCalledWith({ type: "save_concierge_thread" });
  });
});
