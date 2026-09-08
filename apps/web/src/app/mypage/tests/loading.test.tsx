// src/app/mypage/tests/loading.test.tsx
import { render, screen } from "@testing-library/react";

import MyPageView from "@/components/views/MyPageView";

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    loading: true,
    isLoggedIn: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
  }),
}));

describe("MyPage loading", () => {
  it("Skeletonのみを表示し、HUBのsectionは出さない", () => {
    render(
      <MyPageView
        favorites={[]}
        favoritesFetchFailed={false}
        threads={[]}
        threadsFetchFailed={false}
        billingStatus={null}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
  });
});
