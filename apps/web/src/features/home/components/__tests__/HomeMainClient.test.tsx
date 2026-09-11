import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { HomeMainClient } from "../HomeMainClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("HomeMainClient", () => {
  it("既存のConcierge Heroをそのまま保持する", () => {
    render(<HomeMainClient />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("今の相談から、向かう神社を見つける");
    expect(screen.getByRole("button", { name: "この相談ではじめる" })).toBeInTheDocument();
  });

  // 構成順がそのまま階層を表す。相談Heroが主、補助導線はその後ろ。
  it("見出しの出現順はHero → 補助導線グリッドの順を維持する", () => {
    render(<HomeMainClient />);

    const headingTexts = [
      screen.getByRole("heading", { level: 1 }).textContent,
      ...screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ];
    expect(headingTexts).toEqual(["今の相談から、向かう神社を見つける", "ほかの入り口から"]);
  });

  it("候補チップと条件リンクは相談入力カードより後ろに置かれる", () => {
    const { container } = render(<HomeMainClient />);

    const order = Array.from(container.querySelectorAll("textarea, button"));
    const textarea = order.indexOf(screen.getByRole("textbox", { name: "今の気持ちを少しだけ書く" }));
    const submit = order.indexOf(screen.getByRole("button", { name: "この相談ではじめる" }));
    const firstChip = order.indexOf(screen.getByRole("button", { name: "疲れを整えたい" }));
    const conditions = order.indexOf(screen.getByRole("button", { name: "＋ 条件を追加する" }));

    expect(textarea).toBeGreaterThanOrEqual(0);
    expect(submit).toBeGreaterThan(textarea);
    expect(firstChip).toBeGreaterThan(submit);
    expect(conditions).toBeGreaterThan(firstChip);
  });

  it("補助導線（Compass・地図・神社一覧・よく見られている）を保持する", () => {
    render(<HomeMainClient />);
    expect(screen.getByRole("link", { name: /今月から探す/ })).toHaveAttribute("href", "/compass?ref=home");
    expect(screen.getByRole("link", { name: /地図から探す/ })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: /神社一覧/ })).toHaveAttribute("href", "/shrines");
    expect(screen.getByRole("link", { name: /よく見られている/ })).toHaveAttribute("href", "/ranking");
  });
});
