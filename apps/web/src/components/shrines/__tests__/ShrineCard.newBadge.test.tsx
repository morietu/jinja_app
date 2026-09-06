import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ShrineCard } from "@/components/shrines/ShrineCard";

vi.mock("@/lib/analytics/searchEvents", () => ({
  trackSearchEvent: vi.fn(),
}));

describe("ShrineCard 新着バッジ", () => {
  it("isNew=trueのとき「新着」を表示する", () => {
    render(<ShrineCard name="新着神社" shrineId={1} isNew />);

    expect(screen.getByText("新着")).toBeInTheDocument();
  });

  it("isNew=falseのとき「新着」を表示しない", () => {
    render(<ShrineCard name="通常神社" shrineId={2} isNew={false} />);

    expect(screen.queryByText("新着")).toBeNull();
  });

  it("isNew未指定のとき「新着」を表示しない", () => {
    render(<ShrineCard name="通常神社" shrineId={3} />);

    expect(screen.queryByText("新着")).toBeNull();
  });

  it("既存のbadge・本文・リンクを壊さない", () => {
    render(
      <ShrineCard
        name="新着かつおすすめ神社"
        shrineId={4}
        address="東京都千代田区1-1"
        tags={["縁結び"]}
        topReasonLabel="いまの状態に合う"
        isTopPick
        isNew
        href="/shrines/4"
      />,
    );

    expect(screen.getByText("いちばんおすすめ")).toBeInTheDocument();
    expect(screen.getByText("いまの状態に合う")).toBeInTheDocument();
    expect(screen.getByText("新着")).toBeInTheDocument();
    expect(screen.getByText("新着かつおすすめ神社")).toBeInTheDocument();
    expect(screen.getByText("東京都千代田区1-1")).toBeInTheDocument();
    expect(screen.getByText("縁結び")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/shrines/4");
  });
});
