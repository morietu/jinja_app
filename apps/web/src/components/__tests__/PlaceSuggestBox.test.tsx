import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchPlaceCacheSuggestMock = vi.fn();
const fetchPlacesResolveSuggestMock = vi.fn();

vi.mock("@/lib/api/placeCaches", () => ({
  fetchPlaceCacheSuggest: (...args: unknown[]) => fetchPlaceCacheSuggestMock(...args),
}));
vi.mock("@/lib/api/placesResolveSuggest", () => ({
  fetchPlacesResolveSuggest: (...args: unknown[]) => fetchPlacesResolveSuggestMock(...args),
}));

import { PlaceSuggestBox } from "../PlaceSuggestBox";

// NF-2 (Production Smoke Re-check) 回帰ガード。
// 入力中テキストがDark UIで実質判読不能だった(1.78:1が実測されたP1)。
// token名ではなく「Light専用の残渣classが描画結果に現れないこと」を契約として固定する。
const LIGHT_RESIDUE =
  /\b(?:text|bg|border|placeholder|hover:bg|hover:text)-(?:stone|slate|rose|zinc|neutral|gray)-\d{2,3}\b|\bbg-white\b|\btext-white\b/;

const SHRINE = { id: 49, name_jp: "富岡八幡宮", address: "東京都江東区富岡1-20-3" } as never;

describe("PlaceSuggestBox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPlaceCacheSuggestMock.mockResolvedValue([]);
    fetchPlacesResolveSuggestMock.mockResolvedValue([]);
  });

  it("入力欄を表示し、渡された値を保持する", () => {
    render(<PlaceSuggestBox value="富岡" onChange={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByPlaceholderText("神社名や場所を、そっと入れる")).toHaveValue("富岡");
  });

  it("NF-2: 入力欄にLight専用のハードコードclassが残らない", () => {
    const { container } = render(<PlaceSuggestBox value="" onChange={vi.fn()} onSelect={vi.fn()} />);

    expect(container.innerHTML).not.toMatch(LIGHT_RESIDUE);
  });

  it("NF-2: 候補リスト表示時もLight専用のハードコードclassが残らない", async () => {
    fetchPlaceCacheSuggestMock.mockResolvedValue([SHRINE, SHRINE, SHRINE]);
    const { container } = render(<PlaceSuggestBox value="富岡" onChange={vi.fn()} onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText("富岡八幡宮").length).toBeGreaterThan(0), { timeout: 3000 });
    expect(container.innerHTML).not.toMatch(LIGHT_RESIDUE);
  });
});
