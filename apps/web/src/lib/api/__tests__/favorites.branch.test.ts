// apps/web/src/lib/api/__tests__/favorites.branch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// favorites.ts が import する "./client" をモック
vi.mock("../client", () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import api from "../client";
import {
  getFavorites,
  createFavoriteByShrineId,
  
  removeFavoriteByPk,
  removeFavoriteByShrineId,
} from "../favorites";

describe("favorites api branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getFavorites: r.data が配列ならそのまま返す", async () => {
    (api.get as any).mockResolvedValue({ data: [{ id: 1 }] });
    const res = await getFavorites();
    expect(res).toEqual([{ id: 1 }]);
  });

  it("getFavorites: r.data が {results} なら results を返す", async () => {
    (api.get as any).mockResolvedValue({ data: { results: [{ id: 2 }] } });
    const res = await getFavorites();
    expect(res).toEqual([{ id: 2 }]);
  });

  it("getFavorites: r.data が変なら [] を返す", async () => {
    (api.get as any).mockResolvedValue({ data: null });
    const res = await getFavorites();
    expect(res).toEqual([]);
  });

  it("createFavoriteByShrineId: raw が空でも fallback で shrine_id/target を埋める", async () => {
    (api.post as any).mockResolvedValue({ data: { id: 10 } }); // shrine_id など無し
    const res = await createFavoriteByShrineId(123);

    expect(api.post).toHaveBeenCalledWith("/favorites/", { shrine_id: 123 });

    // fallback が効くこと
    expect(res.shrine_id).toBe(123);
    expect(res.target_type).toBe("shrine");
    expect(res.target_id).toBe(123);
    expect(res.shrine?.id).toBe(123);
  });

 

  it("removeFavorite* は正しいURLで delete を呼ぶ", async () => {
    (api.delete as any).mockResolvedValue({});
    await removeFavoriteByPk(1);
    await removeFavoriteByShrineId(2);


    expect(api.delete).toHaveBeenNthCalledWith(1, "/favorites/1/");
    expect(api.delete).toHaveBeenNthCalledWith(2, "/favorites/by-shrine/2/");
  });
});
