import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FavoritesSection from "../FavoritesSection";
import type { Favorite } from "@/lib/api/favorites";

function favorite(id: number, name: string, createdAt: string, publicGoshuinCount = 0): Favorite {
  return {
    id,
    created_at: createdAt,
    public_goshuin_count: publicGoshuinCount,
    shrine: { id: id + 100, name_jp: name, address: `住所${id}` },
  } as Favorite;
}

describe("FavoritesSection（/mypage HUBのpreview）", () => {
  it("created_at降順で最大3件だけ表示する", () => {
    render(
      <FavoritesSection
        favorites={[
          favorite(1, "古い神社", "2026-01-01T00:00:00Z"),
          favorite(2, "最新神社", "2026-09-01T00:00:00Z"),
          favorite(3, "中間神社", "2026-05-01T00:00:00Z"),
          favorite(4, "最古神社", "2025-01-01T00:00:00Z"),
        ]}
        fetchFailed={false}
      />,
    );

    const detailLinks = screen
      .getAllByRole("link", { name: "神社の詳細を見る" })
      .map((link) => link.getAttribute("href"));

    expect(detailLinks).toEqual(["/shrines/102", "/shrines/103", "/shrines/101"]);
    expect(screen.queryByText("最古神社")).toBeNull();
  });

  it("神社名・住所と、総件数・すべて見る導線を表示する", () => {
    render(<FavoritesSection favorites={[favorite(1, "乃木神社", "2026-09-01T00:00:00Z")]} fetchFailed={false} />);

    expect(screen.getByText("乃木神社")).toBeInTheDocument();
    expect(screen.getByText("住所1")).toBeInTheDocument();
    expect(screen.getByText("1件")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "すべて見る" })).toHaveAttribute("href", "/favorites");
  });

  it("公開御朱印がある神社でも、HUBでは御朱印情報と保存解除を出さない", () => {
    render(<FavoritesSection favorites={[favorite(1, "乃木神社", "2026-09-01T00:00:00Z", 5)]} fetchFailed={false} />);

    expect(screen.queryByText("御朱印 5件")).toBeNull();
    expect(screen.queryByRole("link", { name: "御朱印を見る" })).toBeNull();
    expect(screen.queryByRole("button", { name: "保存解除" })).toBeNull();
  });

  it("0件のときはempty stateを出す", () => {
    render(<FavoritesSection favorites={[]} fetchFailed={false} />);

    expect(screen.getByText("保存した神社はまだありません")).toBeInTheDocument();
    expect(screen.getByText("気になる神社を保存できます。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "近くの神社を探す" })).toHaveAttribute("href", "/map");
    expect(screen.queryByRole("link", { name: "すべて見る" })).toBeNull();
  });

  it("取得失敗時はsection内にエラーを出す", () => {
    render(<FavoritesSection favorites={[]} fetchFailed />);

    expect(screen.getByRole("alert")).toHaveTextContent("保存した神社を読み込めませんでした。");
  });
});
