import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MyPageView from "@/components/views/MyPageView";
import type { BillingStatus } from "@/lib/api/billing";
import type { ConciergeThread } from "@/lib/api/concierge/types";
import type { Favorite } from "@/lib/api/favorites";
import type { AuthUser } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  trackConsultationHistoryEntryClicked: vi.fn(),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock("@/lib/analytics/consultationHistoryEvents", () => ({
  trackConsultationHistoryEntryClicked: mocks.trackConsultationHistoryEntryClicked,
}));

const AUTH_USER: AuthUser = {
  id: 1,
  username: "tarou",
  email: "tarou@example.com",
  profile: { nickname: "太郎", is_public: true },
};

const FREE_BILLING: BillingStatus = {
  plan: "free",
  is_active: false,
  provider: "stub",
  current_period_end: null,
  trial_ends_at: null,
  cancel_at_period_end: false,
};

const PREMIUM_BILLING: BillingStatus = {
  ...FREE_BILLING,
  plan: "premium",
  is_active: true,
  provider: "stripe",
};

function thread(overrides: Partial<ConciergeThread> & { id: number }): ConciergeThread {
  return {
    title: "",
    last_message: "",
    last_message_at: null,
    message_count: 0,
    ...overrides,
  };
}

function favorite(id: number, name: string, address: string, createdAt: string): Favorite {
  return {
    id,
    created_at: createdAt,
    public_goshuin_count: 3,
    shrine: { id: id + 100, name_jp: name, address },
  } as Favorite;
}

function renderHub(overrides: Partial<React.ComponentProps<typeof MyPageView>> = {}) {
  return render(
    <MyPageView
      favorites={[]}
      favoritesFetchFailed={false}
      threads={[]}
      threadsFetchFailed={false}
      billingStatus={FREE_BILLING}
      {...overrides}
    />,
  );
}

describe("/mypage HUB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: AUTH_USER, loading: false, isLoggedIn: true });
  });

  describe("Query ParameterタブUI", () => {
    it("旧タブ導線を表示しない", () => {
      renderHub();

      for (const label of ["プロフィール", "投稿した神社", "参拝履歴", "御朱印"]) {
        expect(screen.queryByRole("link", { name: label })).toBeNull();
      }

      const tabLinks = screen
        .getAllByRole("link")
        .filter((link) => (link.getAttribute("href") ?? "").includes("?tab="));
      expect(tabLinks).toHaveLength(0);
    });
  });

  describe("アカウント概要", () => {
    it("nicknameがある場合はnicknameとemailを表示する", () => {
      renderHub();

      expect(screen.getByText("太郎")).toBeInTheDocument();
      expect(screen.getByText("tarou@example.com")).toBeInTheDocument();
    });

    it("nicknameが無い場合はusernameへfallbackする", () => {
      mocks.useAuth.mockReturnValue({
        user: { ...AUTH_USER, profile: { nickname: null } },
        loading: false,
        isLoggedIn: true,
      });

      renderHub();

      expect(screen.getByText("tarou")).toBeInTheDocument();
    });

    it("FREEステータスを表示する", () => {
      renderHub();

      expect(screen.getByText("FREE")).toBeInTheDocument();
      expect(screen.queryByText("Premium")).toBeNull();
    });

    it("plan=premiumかつis_active=trueならPremiumを表示する", () => {
      renderHub({ billingStatus: PREMIUM_BILLING });

      expect(screen.getByText("Premium")).toBeInTheDocument();
      expect(screen.queryByText("FREE")).toBeNull();
    });

    it("plan=premiumでもis_active=falseならFREE扱い", () => {
      renderHub({ billingStatus: { ...PREMIUM_BILLING, is_active: false } });

      expect(screen.getByText("FREE")).toBeInTheDocument();
    });

    it("billingStatusが無い場合もFREE扱いで落ちない", () => {
      renderHub({ billingStatus: null });

      expect(screen.getByText("FREE")).toBeInTheDocument();
    });

    it("プロフィール編集導線は表示しない", () => {
      renderHub();

      expect(screen.queryByRole("link", { name: "プロフィールを編集" })).toBeNull();
      expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/mypage/profile")).toBe(false);
    });
  });

  describe("設定導線", () => {
    it("設定導線は /mypage/settings を指す", () => {
      renderHub();

      expect(screen.getByRole("link", { name: "設定を開く" })).toHaveAttribute("href", "/mypage/settings");
    });
  });

  describe("最近の相談", () => {
    const threads = [
      thread({ id: 1, title: "仕事の相談", last_message: "  最新の  やりとり ", last_message_at: "2026-09-05T10:00:00Z" }),
      thread({ id: 2, title: "", last_message: "", last_message_at: null }),
      thread({ id: 3, title: "三件目", last_message: "3", last_message_at: "2026-09-01T10:00:00Z" }),
      thread({ id: 4, title: "四件目", last_message: "4", last_message_at: "2026-08-01T10:00:00Z" }),
    ];

    it("Backendの順序のまま最大3件だけ表示する", () => {
      renderHub({ threads });

      const section = screen.getByRole("region", { name: "最近の相談" });
      const links = within(section)
        .getAllByRole("link")
        .filter((link) => (link.getAttribute("href") ?? "").startsWith("/mypage/history/"));

      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        "/mypage/history/1",
        "/mypage/history/2",
        "/mypage/history/3",
      ]);
      expect(screen.queryByText("四件目")).toBeNull();
    });

    it("title / last_message preview / last_message_at を表示する", () => {
      renderHub({ threads: [threads[0]] });

      expect(screen.getByText("仕事の相談")).toBeInTheDocument();
      expect(screen.getByText("最新の やりとり")).toBeInTheDocument();
      expect(screen.getByText("2026/09/05")).toBeInTheDocument();
    });

    it("title / last_message が空のときはfallback文言を表示する", () => {
      renderHub({ threads: [threads[1]] });

      expect(screen.getByText("相談タイトル未設定")).toBeInTheDocument();
      expect(screen.getByText("相談内容はまだ記録されていません。")).toBeInTheDocument();
      expect(screen.getByText("日付未記録")).toBeInTheDocument();
    });

    it("message_countは表示しない", () => {
      renderHub({ threads: [thread({ id: 1, title: "相談", message_count: 7 })] });

      expect(screen.queryByText(/7件のやりとり/)).toBeNull();
    });

    it("すべて見るは /mypage/history を指し、既存Analytics eventを送る", () => {
      renderHub({ threads });

      const section = screen.getByRole("region", { name: "最近の相談" });
      const link = within(section).getByRole("link", { name: "すべて見る" });
      expect(link).toHaveAttribute("href", "/mypage/history");

      fireEvent.click(link);
      expect(mocks.trackConsultationHistoryEntryClicked).toHaveBeenCalledTimes(1);
    });

    it("0件のときはempty stateとconcierge CTAを出す", () => {
      renderHub({ threads: [] });

      expect(screen.getByText("まだ相談履歴がありません。")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "コンシェルジュに相談する" })).toHaveAttribute("href", "/concierge");
    });

    it("取得失敗時はsectionだけエラー表示し、他sectionは生きている", () => {
      renderHub({ threadsFetchFailed: true, favorites: [favorite(1, "乃木神社", "東京都港区", "2026-09-01T00:00:00Z")] });

      expect(screen.getByText("相談履歴を読み込めませんでした。")).toBeInTheDocument();
      expect(screen.getByText("太郎")).toBeInTheDocument();
      expect(screen.getByText("乃木神社")).toBeInTheDocument();
    });
  });

  describe("保存した神社", () => {
    const favorites = [
      favorite(1, "古い神社", "東京都1", "2026-01-01T00:00:00Z"),
      favorite(2, "最新神社", "東京都2", "2026-09-01T00:00:00Z"),
      favorite(3, "中間神社", "東京都3", "2026-05-01T00:00:00Z"),
      favorite(4, "最古神社", "東京都4", "2025-01-01T00:00:00Z"),
    ];

    it("created_at降順で最大3件を表示する", () => {
      renderHub({ favorites });

      const section = screen.getByRole("region", { name: /保存した神社/ });
      const detailLinks = within(section)
        .getAllByRole("link", { name: "神社の詳細を見る" })
        .map((link) => link.getAttribute("href"));

      expect(detailLinks).toEqual(["/shrines/102", "/shrines/103", "/shrines/101"]);
      expect(screen.queryByText("最古神社")).toBeNull();
    });

    it("神社名・住所・詳細導線を表示する", () => {
      renderHub({ favorites: [favorites[1]] });

      expect(screen.getByText("最新神社")).toBeInTheDocument();
      expect(screen.getByText("東京都2")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "神社の詳細を見る" })).toHaveAttribute("href", "/shrines/102");
    });

    it("HUBでは御朱印情報と保存解除を表示しない", () => {
      renderHub({ favorites });

      expect(screen.queryByText(/御朱印 \d+件/)).toBeNull();
      expect(screen.queryByRole("link", { name: "御朱印を見る" })).toBeNull();
      expect(screen.queryByRole("button", { name: "保存解除" })).toBeNull();
    });

    it("件数と /favorites 導線を表示する", () => {
      renderHub({ favorites });

      expect(screen.getByText("4件")).toBeInTheDocument();
      const section = screen.getByRole("region", { name: /保存した神社/ });
      expect(within(section).getByRole("link", { name: "すべて見る" })).toHaveAttribute("href", "/favorites");
    });

    it("0件のときはempty stateと /map CTAを出す", () => {
      renderHub({ favorites: [] });

      expect(screen.getByText("保存した神社はまだありません")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "近くの神社を探す" })).toHaveAttribute("href", "/map");
    });

    it("取得失敗時はsectionだけエラー表示し、他sectionは生きている", () => {
      renderHub({ favoritesFetchFailed: true, threads: [thread({ id: 9, title: "相談あり" })] });

      expect(screen.getByText("保存した神社を読み込めませんでした。")).toBeInTheDocument();
      expect(screen.getByText("太郎")).toBeInTheDocument();
      expect(screen.getByText("相談あり")).toBeInTheDocument();
    });
  });
});
