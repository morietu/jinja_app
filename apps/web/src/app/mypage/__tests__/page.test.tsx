import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFavoritesServer: vi.fn(),
  getConciergeThreadsServer: vi.fn(),
  getBillingStatusServer: vi.fn(),
}));

vi.mock("@/lib/api/favorites.server", () => ({ getFavoritesServer: mocks.getFavoritesServer }));
vi.mock("@/lib/api/concierge.server", () => ({ getConciergeThreadsServer: mocks.getConciergeThreadsServer }));
vi.mock("@/lib/api/billing.server", () => ({ getBillingStatusServer: mocks.getBillingStatusServer }));

vi.mock("@/components/views/MyPageView", () => ({
  default: ({
    favorites,
    favoritesFetchFailed,
    threads,
    threadsFetchFailed,
    billingStatus,
  }: {
    favorites: unknown[];
    favoritesFetchFailed: boolean;
    threads: unknown[];
    threadsFetchFailed: boolean;
    billingStatus: { plan?: string } | null;
  }) => (
    <div
      data-testid="hub"
      data-favorites={favorites.length}
      data-favorites-failed={String(favoritesFetchFailed)}
      data-threads={threads.length}
      data-threads-failed={String(threadsFetchFailed)}
      data-plan={billingStatus?.plan ?? "none"}
    />
  ),
}));

const BILLING = { plan: "free", is_active: false };

describe("/mypage page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBillingStatusServer.mockResolvedValue(BILLING);
  });

  it("正常系: 3つのdata sourceをHUBへ渡す", async () => {
    mocks.getFavoritesServer.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.getConciergeThreadsServer.mockResolvedValue([{ id: 10 }]);

    const { default: Page } = await import("../page");
    render(await Page());

    const hub = screen.getByTestId("hub");
    expect(hub).toHaveAttribute("data-favorites", "2");
    expect(hub).toHaveAttribute("data-favorites-failed", "false");
    expect(hub).toHaveAttribute("data-threads", "1");
    expect(hub).toHaveAttribute("data-threads-failed", "false");
    expect(hub).toHaveAttribute("data-plan", "free");
  });

  it("相談履歴の取得に失敗しても、HUB全体は落とさずsection単位でfail-safeにする", async () => {
    mocks.getFavoritesServer.mockResolvedValue([{ id: 1 }]);
    mocks.getConciergeThreadsServer.mockRejectedValue(new Error("getConciergeThreadsServer failed: 500"));

    const { default: Page } = await import("../page");
    render(await Page());

    const hub = screen.getByTestId("hub");
    expect(hub).toHaveAttribute("data-threads-failed", "true");
    expect(hub).toHaveAttribute("data-threads", "0");
    expect(hub).toHaveAttribute("data-favorites", "1");
    expect(hub).toHaveAttribute("data-favorites-failed", "false");
  });

  it("お気に入りの取得に失敗しても、HUB全体は落とさずsection単位でfail-safeにする", async () => {
    mocks.getFavoritesServer.mockRejectedValue(new Error("network error"));
    mocks.getConciergeThreadsServer.mockResolvedValue([{ id: 10 }]);

    const { default: Page } = await import("../page");
    render(await Page());

    const hub = screen.getByTestId("hub");
    expect(hub).toHaveAttribute("data-favorites-failed", "true");
    expect(hub).toHaveAttribute("data-favorites", "0");
    expect(hub).toHaveAttribute("data-threads", "1");
    expect(hub).toHaveAttribute("data-threads-failed", "false");
  });
});
