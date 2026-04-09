// src/app/mypage/tests/not-logged-in.test.tsx
import { render, screen } from "@testing-library/react";
import MyPageView from "@/components/views/MyPageView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: (k: string) => (k === "tab" ? "goshuin" : null) }),
}));

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

vi.mock("@/lib/api/users", () => ({
  updateUser: vi.fn(),
}));

describe("MyPage 未ログイン", () => {
  it("ログイン導線が表示される", async () => {
    render(<MyPageView initialFavorites={[]} />);

    // MyPageView は初回 loading を経由するので findByRole にする
    const link = await screen.findByRole("link", { name: "ログインへ" });
    expect(link).toHaveAttribute("href", "/login?next=%2Fmypage%3Ftab%3Dgoshuin");
  });
});
