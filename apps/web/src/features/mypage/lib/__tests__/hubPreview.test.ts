import { describe, expect, it } from "vitest";

import {
  HUB_PREVIEW_LIMIT,
  resolveDisplayName,
  sortFavoritesByRecentlySaved,
  takeHubPreview,
} from "@/features/mypage/lib/hubPreview";
import type { Favorite } from "@/lib/api/favorites";

function favorite(id: number, createdAt?: string | null): Favorite {
  return { id, created_at: createdAt ?? null } as Favorite;
}

describe("hubPreview", () => {
  it("previewの表示件数は3件", () => {
    expect(HUB_PREVIEW_LIMIT).toBe(3);
  });

  describe("resolveDisplayName", () => {
    it("nicknameがあればnicknameを使う", () => {
      expect(resolveDisplayName({ id: 1, username: "tarou", profile: { nickname: "太郎" } })).toBe("太郎");
    });

    it("nicknameが空ならusernameへfallbackする", () => {
      expect(resolveDisplayName({ id: 1, username: "tarou", profile: { nickname: "   " } })).toBe("tarou");
      expect(resolveDisplayName({ id: 1, username: "tarou", profile: null })).toBe("tarou");
    });

    it("どちらも無い場合は既定文言", () => {
      expect(resolveDisplayName({ id: 1 })).toBe("ユーザー");
      expect(resolveDisplayName(null)).toBe("ユーザー");
    });
  });

  describe("sortFavoritesByRecentlySaved", () => {
    it("created_atの降順に並べる", () => {
      const sorted = sortFavoritesByRecentlySaved([
        favorite(1, "2026-01-01T00:00:00Z"),
        favorite(2, "2026-03-01T00:00:00Z"),
        favorite(3, "2026-02-01T00:00:00Z"),
      ]);

      expect(sorted.map((f) => f.id)).toEqual([2, 3, 1]);
    });

    it("created_atが無い項目は最後に寄せ、入力配列は破壊しない", () => {
      const input = [favorite(1, null), favorite(2, "2026-02-01T00:00:00Z")];
      const sorted = sortFavoritesByRecentlySaved(input);

      expect(sorted.map((f) => f.id)).toEqual([2, 1]);
      expect(input.map((f) => f.id)).toEqual([1, 2]);
    });
  });

  describe("takeHubPreview", () => {
    it("並び替えずに先頭から切り詰める", () => {
      expect(takeHubPreview([5, 4, 3, 2, 1])).toEqual([5, 4, 3]);
    });

    it("件数が上限未満ならそのまま返す", () => {
      expect(takeHubPreview([1])).toEqual([1]);
    });
  });
});
