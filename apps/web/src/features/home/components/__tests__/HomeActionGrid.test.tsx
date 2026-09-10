import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeActionGrid } from "../HomeActionGrid";

// docs/audit/compass-analytics-contract-readiness.md §6 (PR-A): Home discovery
// measurement. 旧 HomeCompassSection.test.tsx から引き継いだ契約。
// PostHog自体ではなくdispatch helperの境界でmockする。
const analyticsMocks = vi.hoisted(() => ({
  trackSearchEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/searchEvents", () => ({
  trackSearchEvent: analyticsMocks.trackSearchEvent,
}));

describe("HomeActionGrid", () => {
  beforeEach(() => {
    analyticsMocks.trackSearchEvent.mockClear();
  });

  it("補助導線を2カラムグリッドの等価なカードとして並べる", () => {
    render(<HomeActionGrid />);

    expect(screen.getByRole("link", { name: /今月から探す/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /地図から探す/ })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: /神社一覧/ })).toHaveAttribute("href", "/shrines");
    expect(screen.getByRole("link", { name: /よく見られている/ })).toHaveAttribute("href", "/ranking");
  });

  it("2x2グリッドとして4枚のカードを持つ", () => {
    render(<HomeActionGrid />);

    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  // Mother Ship決定: 参拝記録はHomeに置かない。現行betaでは保存/お気に入りが
  // ユーザーと神社の関係を表し、MyPage / Favorites から辿る。
  // /goshuins は redirect("/") の行き止まりでもあるため、復活させないことを固定する。
  it("参拝記録の入口をHomeに置かない", () => {
    render(<HomeActionGrid />);

    expect(screen.queryByRole("link", { name: /参拝の記録/ })).toBeNull();
    document.querySelectorAll("a").forEach((a) => {
      expect(a.getAttribute("href")).not.toBe("/goshuins");
    });
  });

  it("Compassは/compassへ?ref=homeを付与したリンクで、Compass自身の入力収集を重複させない", () => {
    render(<HomeActionGrid />);

    expect(screen.getByRole("link", { name: /今月から探す/ })).toHaveAttribute("href", "/compass?ref=home");
  });

  it("Compassクリックでhome_compass_entry_clickをsource=homeで送る（Compass Entry/Activationとは別イベント）", () => {
    render(<HomeActionGrid />);

    fireEvent.click(screen.getByRole("link", { name: /今月から探す/ }));

    expect(analyticsMocks.trackSearchEvent).toHaveBeenCalledWith("home_compass_entry_click", { source: "home" });
  });

  it("Compass以外のカードはアナリティクスを送らない", () => {
    render(<HomeActionGrid />);

    fireEvent.click(screen.getByRole("link", { name: /地図から探す/ }));
    fireEvent.click(screen.getByRole("link", { name: /よく見られている/ }));

    expect(analyticsMocks.trackSearchEvent).not.toHaveBeenCalled();
  });

  // docs/audit/compass-home-entry-ia.md: Compassは Concierge の後続ではなく
  // 独立した入口。旧実装は「相談のあとに、場所でも確かめる」という
  // Concierge前提の見出しを避けるためCompassを別セクションに置いていた。
  // グリッドへ統合した本実装では、見出しがその前提を持たないことで担保する。
  it("グリッドの見出しはConciergeが先行したことを前提としない", () => {
    render(<HomeActionGrid />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("ほかの入り口から");
    expect(heading.textContent).not.toMatch(/相談/);
    expect(heading.textContent).not.toMatch(/あとに/);
  });
});
