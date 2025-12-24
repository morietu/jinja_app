import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MyPageScreen from "../MyPageScreen";
import React from "react";

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseMyGoshuin = vi.fn();
vi.mock("@/features/mypage/hooks", () => ({
  useMyGoshuin: (args: any) => mockUseMyGoshuin(args),
}));

// 子コンポーネントは中身まで追わない（coverage目的）
vi.mock("../GoshuinUploadForm", () => ({
  default: () => <div>UPLOAD_FORM</div>,
}));
vi.mock("../MyGoshuinList", () => ({
  default: () => <div>GOSHUIN_LIST</div>,
}));

describe("MyPageScreen", () => {
  beforeEach(() => {
    mockUseMyGoshuin.mockReturnValue({
      items: [],
      loading: false,
      error: null,
      addItem: vi.fn(),
      removeItem: vi.fn(),
      toggleVisibility: vi.fn(),
    });
  });

  it("loading=true のとき role=status を表示する", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoggedIn: false,
      loading: true,
      logout: vi.fn(),
    });

    render(<MyPageScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("未ログインのとき ログイン導線を表示する", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoggedIn: false,
      loading: false,
      logout: vi.fn(),
    });

    render(<MyPageScreen />);
    expect(screen.getByRole("link", { name: "ログインへ" })).toHaveAttribute("href", "/login?next=/mypage?tab=goshuin");
  });

  it("ログイン時は アップロードと一覧を表示する", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: "u" },
      isLoggedIn: true,
      loading: false,
      logout: vi.fn(),
    });

    render(<MyPageScreen />);
    expect(screen.getByText("御朱印アップロード")).toBeInTheDocument();
    expect(screen.getByText("UPLOAD_FORM")).toBeInTheDocument();
    expect(screen.getByText("GOSHUIN_LIST")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();

    // enabled の条件が効いてるかも軽く担保
    expect(mockUseMyGoshuin).toHaveBeenCalledWith({ enabled: true });
  });
});
