import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import WeeklyThemeSection from "../WeeklyThemeSection";

const THEME = {
  key: "career_next_step",
  title: "次の一歩を書き出す",
  message: "今週は、迷っていることを一行だけ書き出してみる。",
};

describe("WeeklyThemeSection", () => {
  it("見出し・title・messageを表示する", () => {
    render(<WeeklyThemeSection theme={THEME} />);

    expect(screen.getByRole("heading", { name: "今週のテーマ" })).toBeInTheDocument();
    expect(screen.getByText(THEME.title)).toBeInTheDocument();
    expect(screen.getByText(THEME.message)).toBeInTheDocument();
  });

  it("keyはユーザーへ表示しない", () => {
    const { container } = render(<WeeklyThemeSection theme={THEME} />);

    expect(screen.queryByText(THEME.key)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(THEME.key);
  });

  it("Backend copyを加工せずそのまま表示する", () => {
    const raw = {
      key: "weekly_default",
      title: "  前後に空白のあるタイトル  ",
      message: "句点まで含めた本文。",
    };
    const { container } = render(<WeeklyThemeSection theme={raw} />);

    // trim / 整形 / 語尾変更などをFrontendで行わず、受け取った文字列をそのまま出す。
    expect(container.textContent).toContain(raw.title);
    expect(container.textContent).toContain(raw.message);
  });

  it("themeがnullなら何も表示しない", () => {
    const { container } = render(<WeeklyThemeSection theme={null} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("今週のテーマ")).not.toBeInTheDocument();
  });
});
