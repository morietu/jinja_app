import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Shrine } from "@/lib/api/shrines";
import WeeklyFeaturedShrinesSection from "../WeeklyFeaturedShrinesSection";

vi.mock("@/lib/analytics/searchEvents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/searchEvents")>();
  return { ...actual, trackSearchEvent: vi.fn() };
});

import { trackSearchEvent } from "@/lib/analytics/searchEvents";

function shrine(id: number, name: string): Shrine {
  return {
    id,
    name_jp: name,
    address: `東京都千代田区${id}`,
    latitude: 35.0,
    longitude: 139.0,
    goriyaku: `${name}のご利益`,
    goriyaku_tags: [],
  } as Shrine;
}

describe("WeeklyFeaturedShrinesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Backendが返した順序のまま最大3件を表示する", () => {
    const shrines = [shrine(30, "三番目に登録された神社"), shrine(10, "一番目"), shrine(20, "二番目")];
    render(<WeeklyFeaturedShrinesSection shrines={shrines} />);

    expect(screen.getByRole("heading", { name: "今週の神社" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // ID昇順や名前順へ並べ替えない。
    expect(items.map((li) => within(li).getByRole("link").getAttribute("href"))).toEqual([
      "/shrines/30",
      "/shrines/10",
      "/shrines/20",
    ]);
  });

  it("1件でもそのまま表示し、不足分を補充しない", () => {
    render(<WeeklyFeaturedShrinesSection shrines={[shrine(7, "唯一の神社")]} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("唯一の神社")).toBeInTheDocument();
  });

  it("2件でもダミー神社で3件へ埋めない", () => {
    render(<WeeklyFeaturedShrinesSection shrines={[shrine(1, "A神社"), shrine(2, "B神社")]} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("0件なら何も表示しない（ダミー神社を出さない）", () => {
    const { container } = render(<WeeklyFeaturedShrinesSection shrines={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("今週の神社")).not.toBeInTheDocument();
  });

  it("既存 buildShrineCardProps 経路の表示（名称・住所・説明）を再利用する", () => {
    render(<WeeklyFeaturedShrinesSection shrines={[shrine(5, "検証神社")]} />);

    expect(screen.getByText("検証神社")).toBeInTheDocument();
    expect(screen.getByText("東京都千代田区5")).toBeInTheDocument();
    expect(screen.getByText("検証神社のご利益")).toBeInTheDocument();
  });

  it("カード遷移リンクに recommendation_instance_id / recommendation_rank を載せない", () => {
    render(<WeeklyFeaturedShrinesSection shrines={[shrine(5, "検証神社")]} />);

    const href = screen.getByRole("link").getAttribute("href") ?? "";
    expect(href).toBe("/shrines/5");
    expect(href).not.toContain("recommendation_instance_id");
    expect(href).not.toContain("recommendation_rank");
  });

  it("shrine_card_click を source=compass で送る", () => {
    render(<WeeklyFeaturedShrinesSection shrines={[shrine(5, "検証神社")]} />);

    screen.getByRole("link").click();

    expect(trackSearchEvent).toHaveBeenCalledWith("shrine_card_click", {
      source: "compass",
      shrineId: 5,
    });
  });
});
