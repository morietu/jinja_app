// src/app/mypage/tests/not-logged-in.test.tsx
import { render, screen } from "@testing-library/react";

import MyPageView from "@/components/views/MyPageView";

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isLoggedIn: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
  }),
}));

describe("MyPage 未ログイン", () => {
  it("ログイン導線が表示される", async () => {
    render(
      <MyPageView
        favorites={[]}
        favoritesFetchFailed={false}
        threads={[]}
        threadsFetchFailed={false}
        billingStatus={null}
      />,
    );

    const link = await screen.findByRole("link", { name: "ログインへ" });
    expect(link).toHaveAttribute("href", "/auth/login?returnTo=%2Fmypage");
  });
});
