// apps/web/src/app/mypage/tests/profile-website-visibility.test.tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react"
// MyPage は各テストごとに動的 import（モジュールキャッシュを切るため）
const importMyPage = () => import("../page");

// next/navigation は最小限でモック
vi.mock("next/navigation", () => {
  const replace = vi.fn();
  return {
    useRouter: () => ({ replace }),
    useSearchParams: () => new URLSearchParams(""),
  };
});

// 共有: 成功する基本ユーザー（必要に応じて各テストで上書き）
const baseUser = {
  id: 1,
  username: "tester",
  email: "t@example.com",
  first_name: "",
  last_name: "",
  profile: {
    nickname: "tester",
    is_public: false, // 非公開でも自分には表示させたい
    bio: null,
    icon_url: null,
    birthday: null,
    location: null,
    website: null,
  },
};

describe("Profile website visibility", () => {
  beforeEach(() => {
    vi.resetModules(); // モジュールキャッシュをクリア
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("非公開でも website があればリンクで表示される", async () => {
    // useAuth を website ありでモック
    vi.doMock("@/lib/hooks/useAuth", () => ({
      useAuth: () => ({
        user: {
          ...baseUser,
          profile: { ...baseUser.profile, website: "https://example.com" },
        },
        isLoggedIn: true,
        loading: false,
        logout: vi.fn(),
      }),
    }));

    const { default: MyPage } = await importMyPage();
    render(<MyPage />);

    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("website が空/不正なら Web 欄は表示されない（リンクも存在しない）", async () => {
    // useAuth を website なしでモック
    vi.doMock("@/lib/hooks/useAuth", () => ({
      useAuth: () => ({
        user: {
          ...baseUser,
          profile: { ...baseUser.profile, website: null },
        },
        isLoggedIn: true,
        loading: false,
        logout: vi.fn(),
      }),
    }));

    const { default: MyPage } = await importMyPage();
    render(<MyPage />);

    // アクセシブルなリンク要素が無いことを確認
    expect(
      screen.queryByRole("link", { name: "https://example.com" }),
    ).toBeNull();
  });
});
