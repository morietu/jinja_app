// apps/web/src/app/mypage/tests/keyboard-tabs.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react"; // ← waitFor を追加
import React from "react";
import MyPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { username: "u", email: "e", profile: { is_public: true } },
    isLoggedIn: true,
    loading: false,
    logout: vi.fn(),
  }),
}));

describe("MyPage keyboard tabs", () => {
  beforeEach(() => render(<MyPage />));

  it("ArrowRight で次タブに移動", async () => {
    const tablist = screen.getByRole("tablist", { name: "マイページ内タブ" });
    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });

    await waitFor(() => {
      expect(document.activeElement).toBe(tabs[1]);
    });
  });

  it("Home で先頭タブへ", async () => {
    const tablist = screen.getByRole("tablist", { name: "マイページ内タブ" });
    const tabs = screen.getAllByRole("tab");

    tabs[2].focus();
    fireEvent.keyDown(tablist, { key: "Home" });

    await waitFor(() => {
      expect(document.activeElement).toBe(tabs[0]);
    });
  });
});
