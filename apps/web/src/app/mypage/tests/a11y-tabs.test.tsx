// apps/web/src/app/mypage/tests/a11y-tabs.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// next/navigation を最小限モック
vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({ replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(""), // get/toString だけ使っているのでOK
  };
});

// useAuth をモック（ログイン済み・ロード完了の想定）
vi.mock("@/lib/hooks/useAuth", () => {
  return {
    useAuth: () => ({
      user: {
        id: 1,
        username: "tester",
        email: "tester@example.com",
        first_name: "Test",
        last_name: "User",
        profile: {
          nickname: "tester",
          is_public: true,
          icon_url: null,
          birthday: "1990-04-10",
          location: "Tokyo",
        },
      },
      isLoggedIn: true,
      loading: false,
      logout: vi.fn(),
    }),
  };
});

import MyPage from "../page";

describe("MyPage tabs a11y", () => {
  beforeEach(() => {
    // JSDOM の aria を安定させるため（基本不要だけど念のため）
    document.body.innerHTML = "";
  });

  it("tablist と tabpanel が aria で正しく結びついている", () => {
    render(<MyPage />);

    // tablist を取得
    const tablist = screen.getByRole("tablist", { name: "マイページ内タブ" });
    expect(tablist).toBeInTheDocument();

    // 現在選択中の tab と対応する tabpanel のひもづけ
    const activeTab = screen.getByRole("tab", { selected: true });
    expect(activeTab).toBeInTheDocument();

    const controlsId = activeTab.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();

    const panel = screen.getByRole("tabpanel");
    expect(panel).toBeInTheDocument();
    expect(panel.id).toBe(controlsId);

    // tabpanel 側の aria-labelledby も tab の id と一致
    const labelledby = panel.getAttribute("aria-labelledby");
    expect(labelledby).toBeTruthy();
    expect(labelledby).toBe(activeTab.id);
  });
});
