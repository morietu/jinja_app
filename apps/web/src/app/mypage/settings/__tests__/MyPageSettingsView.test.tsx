import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MyPageSettingsView from "@/components/views/MyPageSettingsView";
import type { AuthUser } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  refreshMe: vi.fn(),
  logout: vi.fn(),
  replace: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/users", () => ({ updateUser: mocks.updateUser }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => mocks.useAuth(),
}));

function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    username: "tarou",
    email: "tarou@example.com",
    profile: { nickname: "太郎", is_public: true },
    ...overrides,
  };
}

describe("/mypage/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      user: authUser(),
      loading: false,
      isLoggedIn: true,
      logout: mocks.logout,
      refreshMe: mocks.refreshMe,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("保存済みnicknameを表示名として表示する", () => {
    render(<MyPageSettingsView />);

    expect(screen.getByLabelText("表示名")).toHaveValue("太郎");
    expect(screen.getByRole("button", { name: "表示名を保存" })).toBeDisabled();
  });

  it("表示名を変更したときnicknameだけを更新する", async () => {
    mocks.updateUser.mockResolvedValue(authUser({ profile: { nickname: "次郎", is_public: true } }));

    render(<MyPageSettingsView />);

    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "次郎" } });
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ nickname: "次郎" }));
    expect(await screen.findByText("表示名を保存しました。")).toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshMe).toHaveBeenCalledTimes(1));
  });

  it("表示名保存に失敗しても入力値を保持する", async () => {
    mocks.updateUser.mockRejectedValue(new Error("updateUser failed: 500"));

    render(<MyPageSettingsView />);

    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "次郎" } });
    fireEvent.click(screen.getByRole("button", { name: "表示名を保存" }));

    expect(
      await screen.findByText("表示名を保存できませんでした。入力内容を確認して、もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("表示名")).toHaveValue("次郎");
  });

  it("Personal Contextの入力項目は設定に表示しない", () => {
    render(<MyPageSettingsView />);

    expect(screen.queryByLabelText("生年月日")).toBeNull();
    expect(screen.queryByLabelText(/出生時間/)).toBeNull();
    expect(screen.queryByLabelText("出生地")).toBeNull();
    expect(screen.queryByText("参拝スタイル")).toBeNull();
    expect(screen.queryByText("九星")).toBeNull();
    expect(screen.queryByText("五行")).toBeNull();
  });

  it("プロフィール公開の現在値を表示する", () => {
    render(<MyPageSettingsView />);

    expect(screen.getByRole("checkbox", { name: "プロフィールを公開" })).toBeChecked();
  });

  it("ON/OFFの切り替えでis_publicを更新する", async () => {
    mocks.updateUser.mockResolvedValue(authUser({ profile: { nickname: "太郎", is_public: false } }));

    render(<MyPageSettingsView />);

    fireEvent.click(screen.getByRole("checkbox", { name: "プロフィールを公開" }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ is_public: false }));
    expect(await screen.findByText("公開設定を保存しました。")).toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshMe).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("checkbox", { name: "プロフィールを公開" })).not.toBeChecked();
  });

  it("更新に失敗したら元の状態へ戻し、エラーを出す", async () => {
    mocks.updateUser.mockRejectedValue(new Error("updateUser failed: 500"));

    render(<MyPageSettingsView />);

    fireEvent.click(screen.getByRole("checkbox", { name: "プロフィールを公開" }));

    expect(
      await screen.findByText("公開設定を保存できませんでした。時間をおいて、もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "プロフィールを公開" })).toBeChecked();
  });

  it("is_public=trueかつusernameありなら公開プロフィールへのリンクを出す", () => {
    render(<MyPageSettingsView />);

    expect(screen.getByRole("link", { name: "/users/tarou" })).toHaveAttribute("href", "/users/tarou");
  });

  it("is_public=falseなら公開プロフィールへのリンクを出さない", () => {
    mocks.useAuth.mockReturnValue({
      user: authUser({ profile: { nickname: "太郎", is_public: false } }),
      loading: false,
      isLoggedIn: true,
      logout: mocks.logout,
      refreshMe: mocks.refreshMe,
    });

    render(<MyPageSettingsView />);

    expect(screen.queryByText("公開プロフィールページ")).toBeNull();
    expect(screen.queryByRole("link", { name: "/users/tarou" })).toBeNull();
  });

  it("ログアウトは確認ダイアログでキャンセルできる", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<MyPageSettingsView />);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(window.confirm).toHaveBeenCalledWith("ログアウトしますか？");
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("確認後にログアウトして / へ遷移する", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.logout.mockResolvedValue(undefined);

    render(<MyPageSettingsView />);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
  });

  it("メール変更・パスワード変更・アカウント削除などのplaceholderは置かない", () => {
    render(<MyPageSettingsView />);

    for (const label of ["メールアドレスを変更", "パスワードを変更", "アカウントを削除", "通知設定", "プランを管理"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
});
