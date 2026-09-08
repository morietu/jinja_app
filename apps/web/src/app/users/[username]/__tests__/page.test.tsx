import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPublicProfile: vi.fn(),
}));

vi.mock("@/lib/api/publicProfile", () => ({
  fetchPublicProfile: mocks.fetchPublicProfile,
}));

describe("/users/[username] public profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("公開プロフィールにbirthdayが紛れ込んでも生年月日・年齢を表示しない", async () => {
    mocks.fetchPublicProfile.mockResolvedValue({
      username: "public-user",
      nickname: "公開ユーザー",
      website: null,
      icon_url: null,
      bio: "自己紹介",
      location: "東京都",
      is_public: true,
      // Runtimeで古いresponseが混入した場合でもUIへ露出しないことを固定する。
      birthday: "1990-01-02",
    });

    const { default: Page } = await import("../page");
    render(await Page({ params: { username: "public-user" } }));

    expect(screen.getByRole("heading", { name: "公開ユーザー" })).toBeInTheDocument();
    expect(screen.getByText("東京都")).toBeInTheDocument();
    expect(screen.queryByText("生年月日")).not.toBeInTheDocument();
    expect(screen.queryByText("1990-01-02")).not.toBeInTheDocument();
    expect(screen.queryByText(/歳/)).not.toBeInTheDocument();
  });
});
