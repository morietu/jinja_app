import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// MapPageClientはExploreLayout/位置情報/fetchに依存するため、
// ここではpage自身のDark UI契約(heading)だけを検証対象にする。
vi.mock("@/features/map/components/MapPageClient", () => ({
  default: () => <div data-testid="map-page-client" />,
}));

// NF-2 (Production Smoke Re-check) 回帰ガード。
// Dark UIは`<html class="dark">`固定で、Light値のハードコードclassが残ると
// page headingが実質判読不能になる(1.15:1が実測されたP1)。
// 特定のtoken名や色をliteralで固定せず、「Light専用の残渣classが
// 描画結果に現れないこと」だけを契約として固定する。
const LIGHT_RESIDUE =
  /\b(?:text|bg|border|placeholder|hover:bg|hover:text)-(?:stone|slate|rose|zinc|neutral|gray)-\d{2,3}\b|\bbg-white\b|\btext-white\b/;

describe("MapPage", () => {
  it("見出しと導入文を表示する", async () => {
    const { default: Page } = await import("../page");
    render(<Page />);

    expect(screen.getByRole("heading", { name: "近くの神社" })).toBeInTheDocument();
    expect(screen.getByText("今いる場所から、静かにたどれます。")).toBeInTheDocument();
    expect(screen.getByTestId("map-page-client")).toBeInTheDocument();
  });

  it("NF-2: headerにLight専用のハードコードclassが残らない", async () => {
    const { default: Page } = await import("../page");
    const { container } = render(<Page />);

    expect(container.innerHTML).not.toMatch(LIGHT_RESIDUE);
  });
});
