// apps/web/src/app/mypage/tests/router-replace.test.tsx
import { describe, it, vi, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MyPage from "../page";
import React from "react";


const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("tab=profile"),
}));

vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { username: "test", email: "t@example.com", id: 1, first_name: "", last_name: "", profile: {} },
    isLoggedIn: true,
    loading: false,
    logout: vi.fn(),
  }),
}));

describe("MyPage タブクリックで URL 更新", () => {
  it("favorites タブをクリックすると replace が呼ばれる", () => {
    render(<MyPage />);
    fireEvent.click(screen.getByRole("tab", { name: "お気に入り（準備中）" }));
    expect(replace).toHaveBeenCalled();
    const url = replace.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("/mypage?");
    expect(url).toContain("tab=favorites");
  });
});
