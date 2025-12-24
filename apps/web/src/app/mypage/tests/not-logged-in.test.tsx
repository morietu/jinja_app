// apps/web/src/app/mypage/tests/not-logged-in.test.tsx
import { describe, it, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MyPage from "../page";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    isLoggedIn: false,
    loading: false,
    logout: vi.fn(),
  }),
}));

describe("MyPage 未ログイン", () => {
  it("ログイン導線が表示される", () => {
    render(<MyPage />);
    expect(screen.getByRole("link", { name: "ログインへ" })).toHaveAttribute("href", "/login?next=/mypage?tab=goshuin");
  });
});
