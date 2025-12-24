// apps/web/src/app/mypage/tests/not-logged-in.test.tsx
import { describe, it, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MyPage from "../page";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=goshuin"),
}));

vi.mock("@/lib/api/users", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  updateUser: vi.fn(),
}));

describe("MyPage 未ログイン", () => {
  it("ログイン導線が表示される", async () => {
    render(<MyPage />);

    const link = await screen.findByRole("link", { name: "ログインへ" });
    expect(link).toHaveAttribute("href", "/login?next=%2Fmypage%3Ftab%3Dgoshuin");
  });
});
