import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BillingManagePage from "../page";
import type { BillingStatus } from "@/lib/api/billing";

const getBillingStatusMock = vi.fn();
const startBillingPortalMock = vi.fn();
const assignMock = vi.fn();

vi.mock("@/lib/api/billing", () => ({
  getBillingStatus: () => getBillingStatusMock(),
  startBillingPortal: () => startBillingPortalMock(),
}));

function status(overrides: Partial<BillingStatus> = {}): BillingStatus {
  return {
    plan: "premium",
    is_active: true,
    provider: "stripe",
    current_period_end: null,
    trial_ends_at: null,
    cancel_at_period_end: false,
    ...overrides,
  };
}

describe("BillingManagePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { assign: assignMock },
      writable: true,
    });
  });

  it("Premium有効ならStripe Customer Portalへ遷移できる", async () => {
    getBillingStatusMock.mockResolvedValue(status());
    startBillingPortalMock.mockResolvedValue({
      portal_url: "https://billing.stripe.com/p/session/bps_123",
    });

    render(<BillingManagePage />);

    const button = await screen.findByRole("button", { name: "プランを管理" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(startBillingPortalMock).toHaveBeenCalledTimes(1);
      expect(assignMock).toHaveBeenCalledWith("https://billing.stripe.com/p/session/bps_123");
    });
  });

  it("FreeではPortalを開始できずアップグレード導線を出す", async () => {
    getBillingStatusMock.mockResolvedValue(status({ plan: "free", is_active: false }));

    render(<BillingManagePage />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "プランを管理" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プレミアムにする" })).toHaveAttribute(
      "href",
      "/billing/upgrade",
    );
    expect(startBillingPortalMock).not.toHaveBeenCalled();
  });

  it("cancel_at_period_end=true なら解約予定として表示し、Premium表示は維持する", async () => {
    getBillingStatusMock.mockResolvedValue(
      status({
        cancel_at_period_end: true,
        current_period_end: "2026-10-01T00:00:00Z",
      }),
    );

    render(<BillingManagePage />);

    expect(await screen.findByText("Premium（有効）")).toBeInTheDocument();
    expect(screen.getByText(/解約予定です。/)).toBeInTheDocument();
    expect(screen.getByText(/2026年10月1日/)).toBeInTheDocument();
    expect(screen.queryByText(/次回更新日/)).not.toBeInTheDocument();
  });

  it("current_period_endがあれば次回更新日を表示する", async () => {
    getBillingStatusMock.mockResolvedValue(
      status({ current_period_end: "2026-10-01T00:00:00Z" }),
    );

    render(<BillingManagePage />);

    expect(await screen.findByText(/次回更新日：2026年10月1日/)).toBeInTheDocument();
    expect(screen.queryByText(/解約予定です。/)).not.toBeInTheDocument();
  });

  it("Portalから戻ったらbilling statusをBackendから取り直す", async () => {
    getBillingStatusMock.mockResolvedValue(status());

    render(<BillingManagePage />);

    await screen.findByRole("button", { name: "プランを管理" });
    expect(getBillingStatusMock).toHaveBeenCalledTimes(1);

    // bfcache 復元（Portal からの戻り）でも正本を取り直す
    getBillingStatusMock.mockResolvedValue(
      status({ cancel_at_period_end: true, current_period_end: "2026-10-01T00:00:00Z" }),
    );
    const pageShow = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(pageShow, "persisted", { value: true });
    fireEvent(window, pageShow);

    await waitFor(() => {
      expect(getBillingStatusMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/解約予定です。/)).toBeInTheDocument();
  });

  it("Portal生成に失敗したらgenericな日本語エラーを表示する", async () => {
    getBillingStatusMock.mockResolvedValue(status());
    startBillingPortalMock.mockRejectedValue(new Error("billing portal 503"));

    render(<BillingManagePage />);

    fireEvent.click(await screen.findByRole("button", { name: "プランを管理" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("管理画面を開けませんでした。時間をおいて再度お試しください。");
    expect(alert.textContent).not.toContain("503");
    expect(assignMock).not.toHaveBeenCalled();
  });
});
