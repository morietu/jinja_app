// apps/web/src/app/billing/upgrade/__tests__/page.test.tsx
import { render, screen } from "@testing-library/react";
import BillingUpgradePage from "../page";

describe("BillingUpgradePage", () => {
  it("価値訴求と導線を表示する", () => {
    render(<BillingUpgradePage />);

    expect(
      screen.getByRole("heading", {
        name: "もっと自分に合う神社提案を受け取りたい方へ",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("無料プランとの違い")).toBeInTheDocument();
    expect(screen.getByText("無料")).toBeInTheDocument();
    expect(screen.getByText("プレミアム")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "無料でコンシェルジュを使う" })).toHaveAttribute("href", "/concierge");

    expect(screen.getByRole("link", { name: "プラン状況を確認する" })).toHaveAttribute("href", "/billing");
  });
});
