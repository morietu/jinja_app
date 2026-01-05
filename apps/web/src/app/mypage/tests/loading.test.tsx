// src/app/mypage/tests/loading.test.tsx
import { render, screen } from "@testing-library/react";
import MyPageView from "@/components/views/MyPageView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: (k: string) => (k === "tab" ? "profile" : null) }),
}));

vi.mock("@/lib/api/users", () => ({
  getCurrentUser: vi.fn(() => new Promise(() => {})), // 永遠にresolveしない=loading固定
  updateUser: vi.fn(),
}));

describe("MyPage loading", () => {
  it("Skeletonのみを表示し、tabpanelは出さない", () => {
    render(<MyPageView initialFavorites={[]} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });
});
