import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildConciergeHref, HomeHeroConsultationInput } from "../HomeHeroConsultationInput";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

describe("buildConciergeHref", () => {
  it("returns concierge URL with encoded theme when theme exists", () => {
    expect(buildConciergeHref("仕事の迷いを整理したい")).toBe(
      "/concierge?theme=%E4%BB%95%E4%BA%8B%E3%81%AE%E8%BF%B7%E3%81%84%E3%82%92%E6%95%B4%E7%90%86%E3%81%97%E3%81%9F%E3%81%84",
    );
  });

  it("returns concierge URL with theme and openFilter when both exist", () => {
    expect(buildConciergeHref("少し休みたい", { openFilter: true })).toBe(
      "/concierge?theme=%E5%B0%91%E3%81%97%E4%BC%91%E3%81%BF%E3%81%9F%E3%81%84&openFilter=1",
    );
  });

  it("returns concierge URL with only openFilter when theme is empty", () => {
    expect(buildConciergeHref("", { openFilter: true })).toBe("/concierge?openFilter=1");
  });

  it("returns concierge URL without query when theme is empty and openFilter is false", () => {
    expect(buildConciergeHref("")).toBe("/concierge");
  });
});

describe("HomeHeroConsultationInput", () => {
  it("chip選択後に相談を開始できる", () => {
    render(<HomeHeroConsultationInput />);

    fireEvent.click(screen.getByRole("button", { name: "疲れを整えたい" }));
    fireEvent.click(screen.getByRole("button", { name: "この相談ではじめる" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/concierge?theme=%E6%9C%80%E8%BF%91%E5%B0%91%E3%81%97%E7%96%B2%E3%82%8C%E3%81%A6%E3%81%84%E3%81%A6%E3%80%81%E6%B0%97%E6%8C%81%E3%81%A1%E3%82%92%E8%90%BD%E3%81%A1%E7%9D%80%E3%81%91%E3%82%8B%E5%8F%82%E6%8B%9D%E3%81%8C%E3%81%97%E3%81%9F%E3%81%84%E3%81%A7%E3%81%99",
    );
  });

  it("themeありで条件を追加するとthemeとopenFilterを付けて遷移する", () => {
    render(<HomeHeroConsultationInput />);

    fireEvent.change(screen.getByLabelText("今の気持ちを少しだけ書く"), {
      target: { value: "仕事の流れを整えたい" },
    });
    fireEvent.click(screen.getByRole("button", { name: "＋ 条件を追加する" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/concierge?theme=%E4%BB%95%E4%BA%8B%E3%81%AE%E6%B5%81%E3%82%8C%E3%82%92%E6%95%B4%E3%81%88%E3%81%9F%E3%81%84&openFilter=1",
    );
  });

  it("themeなしで条件を追加するとopenFilterだけを付けて遷移する", () => {
    render(<HomeHeroConsultationInput />);

    fireEvent.click(screen.getByRole("button", { name: "＋ 条件を追加する" }));

    expect(pushMock).toHaveBeenCalledWith("/concierge?openFilter=1");
  });
});
