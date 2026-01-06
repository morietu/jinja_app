import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../client";
import { getFavorites } from "../favorites";

vi.mock("../client", () => {
  return {
    default: {
      get: vi.fn(),
    },
  };
});

describe("getFavorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("配列レスポンスをそのまま返す", async () => {
    (api.get as any).mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
    });

    const result = await getFavorites();
    expect(result).toHaveLength(2);
  });

  it("results 配下の配列を返す", async () => {
    (api.get as any).mockResolvedValue({
      data: { results: [{ id: 3 }] },
    });

    const result = await getFavorites();
    expect(result).toEqual([{ id: 3 }]);
  });
});
