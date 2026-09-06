import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ConsultationHistoryDetailView from "../ConsultationHistoryDetailView";
import type { ConciergeThreadDetail } from "@/lib/api/concierge/types";

const refreshMock = vi.fn();
const useAuthMock = vi.fn();
const trackDetailViewedMock = vi.fn();
const trackShrineOpenedMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/analytics/consultationHistoryEvents", () => ({
  trackConsultationHistoryDetailViewed: (...args: unknown[]) => trackDetailViewedMock(...args),
  trackConsultationHistoryShrineOpened: (...args: unknown[]) => trackShrineOpenedMock(...args),
}));

const THREAD: ConciergeThreadDetail = {
  id: 42,
  title: "縁結びの相談",
  last_message: "ありがとうございました。",
  last_message_at: "2026-07-20T10:00:00Z",
  message_count: 2,
  messages: [
    { id: 1, thread_id: 42, role: "user", content: "良い神社を探しています。", created_at: "2026-07-20T09:00:00Z" },
    { id: 2, thread_id: 42, role: "assistant", content: "こちらはいかがでしょうか。", created_at: "2026-07-20T09:05:00Z" },
  ],
  recommendations_v2: [
    {
      shrine_id: 5,
      name: "根津神社",
      address: "東京都文京区根津1-28-9",
      action_state: "saved",
      recommendation_reason_v4_detail: {
        version: "v4",
        reason_text: "縁結びの神として知られています。",
        fact: {
          label: "根津神社",
          name: "根津神社",
          deity: "須佐之男命",
          shrine_history: null,
          place_context: "東京都文京区根津1-28-9",
          history_theme: null,
          goriyaku: null,
          visit_style_tags: [],
          evidence: [],
        },
        interpretation: { theme: "縁結び", text: "新しい縁が結ばれる時期です。" },
        action: { text: "静かに参拝してみましょう。", source: "template" },
      },
    },
  ],
};

describe("ConsultationHistoryDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証状態読み込み中はLoading状態を表示する", () => {
    useAuthMock.mockReturnValue({ loading: true, isLoggedIn: false });
    render(<ConsultationHistoryDetailView tid="42" thread={null} fetchFailed={false} />);

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });

  it("未ログイン(401/403相当)のときログイン導線を表示し、returnToにtidを含む", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: false });
    render(<ConsultationHistoryDetailView tid="42" thread={null} fetchFailed={false} />);

    expect(screen.getByRole("link", { name: "ログインへ" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fmypage%2Fhistory%2F42",
    );
  });

  it("取得失敗時はError状態とRetry導線を表示し、クリックでrouter.refreshが呼ばれる", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    render(<ConsultationHistoryDetailView tid="42" thread={null} fetchFailed={true} />);

    expect(screen.getByText("相談履歴を読み込めませんでした。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("fetchFailed時はdetail_viewedを送らない", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    render(<ConsultationHistoryDetailView tid="42" thread={null} fetchFailed={true} />);

    expect(trackDetailViewedMock).not.toHaveBeenCalled();
  });

  it("Direct Navigation: 不正または存在しないtid(thread=null)のとき見つからない旨を表示する", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    render(<ConsultationHistoryDetailView tid="999" thread={null} fetchFailed={false} />);

    expect(screen.getByText("この相談は見つかりませんでした。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "相談履歴の一覧へ戻る" })).toHaveAttribute("href", "/mypage/history");
  });

  it("not_found(thread=null)時はdetail_viewedを送らない", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    render(<ConsultationHistoryDetailView tid="999" thread={null} fetchFailed={false} />);

    expect(trackDetailViewedMock).not.toHaveBeenCalled();
  });

  it("正常系: 会話履歴と推薦神社カード、Explanation-only Fact、action_stateバッジを表示し、detail_viewedを送る", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    render(<ConsultationHistoryDetailView tid="42" thread={THREAD} fetchFailed={false} />);

    expect(screen.getByRole("heading", { name: "縁結びの相談" })).toBeInTheDocument();
    expect(screen.getByText("良い神社を探しています。")).toBeInTheDocument();
    expect(screen.getByText("こちらはいかがでしょうか。")).toBeInTheDocument();

    expect(screen.getByText("根津神社")).toBeInTheDocument();
    expect(screen.getByText("気になる登録済み")).toBeInTheDocument();
    // App-wide Evidence & Dark UI Regression Audit Bug-2: fixtureのfactはdeity(須佐之男命)が
    // 勝ちfact -- Explanation-only Knowledge Fact(Rank/Eligibilityに一切寄与しない)であり、
    // Ranking reasonの本文枠(通常のfactText、data-testidなし)には出さず、「参考情報」枠へ分離する。
    expect(screen.queryByTestId("consultation-history-explanation-only-fact")).toHaveTextContent(
      "参考情報: 須佐之男命",
    );

    expect(trackDetailViewedMock).toHaveBeenCalledWith({
      threadId: 42,
      recommendationCount: 1,
      messageCount: 2,
    });
    expect(trackDetailViewedMock).toHaveBeenCalledTimes(1);
  });

  // Case 2 (Shrine Detail Ranking Evidence相当): 通常のRanking Evidence(goriyaku)は
  // 引き続きRecommendation reasonとして表示される(Explanation-only枠へは分離されない)。
  it("Bug-2: Ranking Evidence(goriyaku)が勝ちfactの場合は通常のFact枠に残り、参考情報枠は生成されない", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    const threadWithGoriyaku: ConciergeThreadDetail = {
      ...THREAD,
      recommendations_v2: [
        {
          ...THREAD.recommendations_v2![0],
          recommendation_reason_v4_detail: {
            ...THREAD.recommendations_v2![0].recommendation_reason_v4_detail!,
            fact: {
              ...THREAD.recommendations_v2![0].recommendation_reason_v4_detail!.fact,
              deity: null,
              goriyaku: "縁結び",
            },
          },
        },
      ],
    };
    render(<ConsultationHistoryDetailView tid="42" thread={threadWithGoriyaku} fetchFailed={false} />);

    expect(screen.getByText("縁結び")).toBeInTheDocument();
    expect(screen.queryByTestId("consultation-history-explanation-only-fact")).not.toBeInTheDocument();
  });

  // Case 4 (Mixed Evidence相当): Ranking Evidence(goriyaku)とExplanation-only Fact(deity)が
  // 両方存在しても、優先順位(deity > shrine_history > goriyaku > history_theme)により
  // deityが勝ちfactとなる。この場合も両者が混ざらず、通常のFact枠には出ないことを確認する。
  it("Bug-2: deityが勝ちfactの場合、goriyakuが存在しても通常のFact枠には混入しない", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    const threadWithBoth: ConciergeThreadDetail = {
      ...THREAD,
      recommendations_v2: [
        {
          ...THREAD.recommendations_v2![0],
          recommendation_reason_v4_detail: {
            ...THREAD.recommendations_v2![0].recommendation_reason_v4_detail!,
            fact: {
              ...THREAD.recommendations_v2![0].recommendation_reason_v4_detail!.fact,
              goriyaku: "縁結び",
            },
          },
        },
      ],
    };
    render(<ConsultationHistoryDetailView tid="42" thread={threadWithBoth} fetchFailed={false} />);

    expect(screen.queryByTestId("consultation-history-explanation-only-fact")).toHaveTextContent(
      "参考情報: 須佐之男命",
    );
    expect(screen.queryByText("縁結び")).not.toBeInTheDocument();
  });

  it("同一tidの再レンダーではdetail_viewedが重複発火しない", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    const { rerender } = render(<ConsultationHistoryDetailView tid="42" thread={THREAD} fetchFailed={false} />);

    expect(trackDetailViewedMock).toHaveBeenCalledTimes(1);

    rerender(<ConsultationHistoryDetailView tid="42" thread={THREAD} fetchFailed={false} />);
    rerender(<ConsultationHistoryDetailView tid="42" thread={THREAD} fetchFailed={false} />);

    expect(trackDetailViewedMock).toHaveBeenCalledTimes(1);
  });

  it("Shrine Detail遷移: 推薦神社カードのリンクがctx=concierge&tidを維持する", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    render(<ConsultationHistoryDetailView tid="42" thread={THREAD} fetchFailed={false} />);

    expect(screen.getByRole("link", { name: "神社の詳細を見る" })).toHaveAttribute(
      "href",
      "/shrines/5?ctx=concierge&tid=42",
    );
  });

  // NF-1 (Production Smoke Re-check) 回帰ガード。
  // Dark UIは`<html class="dark">`固定で、Light値のハードコードclassが残ると
  // title / CTA / 本文が実質判読不能になる(CTA 1.08:1 / title 1.33:1が実測されたP1)。
  // 特定のtoken名や色をliteralで固定するのではなく、「Light専用の残渣classが
  // 描画結果に現れないこと」だけを契約として固定する。
  const LIGHT_RESIDUE = /\b(?:text|bg|border|placeholder|hover:bg|hover:text)-(?:stone|slate|rose|zinc|neutral)-\d{2,3}\b|\bbg-white\b|\btext-white\b/;

  it.each([
    ["loading", { loading: true, isLoggedIn: false }, null, false] as const,
    ["unauthenticated", { loading: false, isLoggedIn: false }, null, false] as const,
    ["fetchFailed", { loading: false, isLoggedIn: true }, null, true] as const,
    ["not_found", { loading: false, isLoggedIn: true }, null, false] as const,
  ])("NF-1: %s状態にLight専用のハードコードclassが残らない", (_name, auth, thread, fetchFailed) => {
    useAuthMock.mockReturnValue(auth);
    const { container } = render(
      <ConsultationHistoryDetailView tid="42" thread={thread} fetchFailed={fetchFailed} />,
    );

    expect(container.innerHTML).not.toMatch(LIGHT_RESIDUE);
  });

  it("NF-1: 正常系(タイトル・推薦カード・会話履歴)にLight専用のハードコードclassが残らない", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    const { container } = render(
      <ConsultationHistoryDetailView tid="42" thread={THREAD} fetchFailed={false} />,
    );

    expect(container.innerHTML).not.toMatch(LIGHT_RESIDUE);
  });

  it("神社詳細操作時にshrine_openedをthreadId・shrineId・recommendationRank(1始まり)で送る", () => {
    useAuthMock.mockReturnValue({ loading: false, isLoggedIn: true });
    render(<ConsultationHistoryDetailView tid="42" thread={THREAD} fetchFailed={false} />);

    fireEvent.click(screen.getByRole("link", { name: "神社の詳細を見る" }));

    expect(trackShrineOpenedMock).toHaveBeenCalledWith({ threadId: "42", shrineId: 5, recommendationRank: 1 });
  });
});
