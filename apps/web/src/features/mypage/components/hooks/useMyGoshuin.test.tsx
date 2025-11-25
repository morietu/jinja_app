// apps/web/src/features/mypage/components/hooks/useMyGoshuin.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMyGoshuin } from "./useMyGoshuin";
import { fetchMyGoshuin } from "@/lib/api/goshuin";

vi.mock("@/lib/api/goshuin", () => ({
  fetchMyGoshuin: vi.fn(),
}));

describe("useMyGoshuin", () => {
  it("初回に fetchMyGoshuin を呼び出し、items に結果が入る", async () => {
    (fetchMyGoshuin as any).mockResolvedValue([{ id: 1, shrine: 1, is_public: true }]);

    const { result } = renderHook(() => useMyGoshuin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });
  });

  it("エラー時には error メッセージがセットされる", async () => {
    (fetchMyGoshuin as any).mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useMyGoshuin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("御朱印一覧の取得に失敗しました。");
    });
  });
});
