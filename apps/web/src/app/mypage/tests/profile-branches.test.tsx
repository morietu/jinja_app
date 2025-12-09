// apps/web/src/app/mypage/tests/profile-branches.test.tsx
import React from "react";
import { describe, it, vi, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=profile"),
}));

const baseUser = {
  id: 1,
  username: "tester",
  email: "t@example.com",
  first_name: "",
  last_name: "",
};

afterEach(() => {
  // 各テスト毎にモジュールキャッシュをクリアして、doMock を反映させる
  vi.resetModules();
  vi.doUnmock("@/lib/hooks/useAuth");
});

describe("Profile 分岐", () => {
  it("birthday と age を表示する", async () => {
    vi.doMock("@/lib/hooks/useAuth", () => ({
      useAuth: () => ({
        user: { ...baseUser, profile: { birthday: "1990-04-10" } },
        isLoggedIn: true, loading: false, logout: vi.fn(),
      }),
    }));

    const { default: MyPage } = await import("../page");
    render(<MyPage />);

    // ロケール表記ゆれを許容（1990/04/10 か 1990-04-10）
    expect(screen.getByText(/1990[/-]04[/-]10/)).toBeInTheDocument();
    expect(screen.getByText(/歳/)).toBeInTheDocument();
  });

  it("website があればリンク表示、無ければ '-'", async () => {
    // 1回目: website あり
    vi.doMock("@/lib/hooks/useAuth", () => ({
      useAuth: () => ({
        user: { ...baseUser, profile: { website: "https://example.com" } },
        isLoggedIn: true, loading: false, logout: vi.fn(),
      }),
    }));
    const { default: MyPageWithSite } = await import("../page");
    const { rerender } = render(<MyPageWithSite />);
    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link).toHaveAttribute("href", "https://example.com");

    // 2回目: website なし（キャッシュを消して別実装を読み直す）
    vi.resetModules();
    vi.doMock("@/lib/hooks/useAuth", () => ({
      useAuth: () => ({
        user: { ...baseUser, profile: {} },
        isLoggedIn: true, loading: false, logout: vi.fn(),
      }),
    }));
    const { default: MyPageNoSite } = await import("../page");
    rerender(<MyPageNoSite />);
    // 「-」がどこかに表示される（Web/地域/生年月日など）
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});

  it("公開プロフィールリンクは公開時だけ表示される", async () => {
    // 公開中
    vi.doMock("@/lib/hooks/useAuth", () => ({
      useAuth: () => ({
        user: { ...baseUser, profile: { is_public: true } },
        isLoggedIn: true,
        loading: false,
        logout: vi.fn(),
      }),
    }));
    const { default: MyPagePublic } = await import("../page");
    const { rerender } = render(<MyPagePublic />);

    expect(screen.getByText("公開プロフィールを見る")).toBeInTheDocument();

    // 非公開にして再レンダー
    vi.resetModules();
    vi.doMock("@/lib/hooks/useAuth", () => ({
      useAuth: () => ({
        user: { ...baseUser, profile: { is_public: false } },
        isLoggedIn: true,
        loading: false,
        logout: vi.fn(),
      }),
    }));
    const { default: MyPagePrivate } = await import("../page");
    rerender(<MyPagePrivate />);

    expect(screen.queryByText("公開プロフィールを見る")).toBeNull();
  });
