// apps/web/src/features/mypage/__tests__/useMyGoshuin.planlimit.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/api/goshuin", () => {
  return {
    fetchMyGoshuin: vi.fn().mockResolvedValue([]),
    deleteMyGoshuin: vi.fn(),
    updateMyGoshuinVisibility: vi.fn(),
    uploadMyGoshuin: vi.fn(),
  };
});

import axios from "axios";
import { uploadMyGoshuin } from "@/lib/api/goshuin";
import { useMyGoshuin } from "../hooks";

describe("useMyGoshuin upload plan limit branch", () => {
  it("PLAN_LIMIT_EXCEEDED のとき limit を使ったエラーメッセージになる（limit未指定なら10）", async () => {
    // axios.isAxiosError(e) が true になる形を作る
    const err = {
      isAxiosError: true,
      response: { status: 403, data: { code: "PLAN_LIMIT_EXCEEDED" } }, // limit なし → 10 fallback
    };

    vi.spyOn(axios, "isAxiosError").mockImplementation((e: any) => !!e?.isAxiosError);
    (uploadMyGoshuin as any).mockRejectedValue(err);

    const { result } = renderHook(() => useMyGoshuin());

    const file = new File(["x"], "a.png", { type: "image/png" });

    await act(async () => {
      const r = await result.current.upload({ shrineId: 1, title: "t", isPublic: true, file });
      expect(r).toBeNull();
    });

    expect(result.current.error).toBe("御朱印は最大10件までです。不要な御朱印を削除してから追加してください。");
  });
});
