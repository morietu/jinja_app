// apps/web/src/app/mypage/tests/loading.test.tsx
import { describe, it, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MyPage from "../page";
import React from "react";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, loading: true, logout: vi.fn() }),
}));

describe("MyPage loading", () => {
  it("Skeletonのみを表示し、tabpanelは出さない", () => {
    render(<MyPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });
});
