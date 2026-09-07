import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MyPageProfileView from "@/components/views/MyPageProfileView";
import type { AuthUser } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  refreshMe: vi.fn(),
}));

vi.mock("@/lib/api/users", () => ({ updateUser: mocks.updateUser }));

const AUTH_USER: AuthUser = {
  id: 1,
  username: "tarou",
  email: "tarou@example.com",
  profile: {
    nickname: "太郎",
    is_public: true,
    birthday: "1984-05-15",
    birth_time: "05:25:00",
    birth_place: "東京都",
    worship_style: "朝参り",
  },
};

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: AUTH_USER, loading: false, isLoggedIn: true, refreshMe: mocks.refreshMe }),
}));

describe("/mypage/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("編集対象の4項目を表示する", () => {
    render(<MyPageProfileView />);

    expect(screen.getByLabelText("ニックネーム")).toHaveValue("太郎");
    expect(screen.getByLabelText("生年月日")).toHaveValue("1984-05-15");
    expect(screen.getByLabelText(/出生時間/)).toHaveValue("05:25");
    expect(screen.getByLabelText("出生地")).toHaveValue("東京都");
  });

  it("worship_style / 派生プロフィール / is_public は表示しない", () => {
    render(<MyPageProfileView />);

    expect(screen.queryByText("参拝スタイル")).toBeNull();
    expect(screen.queryByRole("button", { name: "朝参り" })).toBeNull();
    expect(screen.queryByText("九星")).toBeNull();
    expect(screen.queryByText("五行")).toBeNull();
    expect(screen.queryByText("ライフパス")).toBeNull();
    expect(screen.queryByText(/吉方位/)).toBeNull();
    expect(screen.queryByText("プロフィールを公開")).toBeNull();
  });

  it("マイページへの戻り導線がある", () => {
    render(<MyPageProfileView />);

    expect(screen.getByRole("link", { name: "← マイページへ" })).toHaveAttribute("href", "/mypage");
  });

  it("未変更なら保存・変更を破棄は無効（dirty判定）", () => {
    render(<MyPageProfileView />);

    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "変更を破棄" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("ニックネーム"), { target: { value: "次郎" } });

    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "変更を破棄" })).toBeEnabled();
  });

  it("変更したfieldだけをPATCHし、成功メッセージを出してrefreshMeする", async () => {
    mocks.updateUser.mockResolvedValue({
      ...AUTH_USER,
      profile: { ...AUTH_USER.profile, nickname: "次郎", birth_place: "京都府" },
    });

    render(<MyPageProfileView />);

    fireEvent.change(screen.getByLabelText("ニックネーム"), { target: { value: "次郎" } });
    fireEvent.change(screen.getByLabelText("出生地"), { target: { value: "京都府" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({ nickname: "次郎", birth_place: "京都府" }),
    );
    expect(await screen.findByText("プロフィールを保存しました。")).toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshMe).toHaveBeenCalledTimes(1));
  });

  it("保存に失敗したらエラーメッセージを出し、入力は保持する", async () => {
    mocks.updateUser.mockRejectedValue(new Error("updateUser failed: 500"));

    render(<MyPageProfileView />);

    fireEvent.change(screen.getByLabelText("ニックネーム"), { target: { value: "次郎" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("プロフィールを保存できませんでした。入力内容を確認して、もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("ニックネーム")).toHaveValue("次郎");
  });

  it("変更を破棄で元の値に戻る", () => {
    render(<MyPageProfileView />);

    fireEvent.change(screen.getByLabelText("ニックネーム"), { target: { value: "次郎" } });
    fireEvent.click(screen.getByRole("button", { name: "変更を破棄" }));

    expect(screen.getByLabelText("ニックネーム")).toHaveValue("太郎");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });
});
