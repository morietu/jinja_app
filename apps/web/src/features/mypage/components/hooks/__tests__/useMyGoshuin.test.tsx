// apps/web/src/features/mypage/components/hooks/__tests__/useMyGoshuin.test.tsx
import React, { useEffect } from "react";
import { render, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useMyGoshuin } from "../useMyGoshuin";
import type { Goshuin } from "@/lib/api/goshuin";

// goshuin API をモック
vi.mock("@/lib/api/goshuin", () => {
  return {
    fetchMyGoshuin: vi.fn(),
    deleteMyGoshuin: vi.fn(),
    updateMyGoshuinVisibility: vi.fn(),
  };
});

import { fetchMyGoshuin, deleteMyGoshuin, updateMyGoshuinVisibility } from "@/lib/api/goshuin";

const mockFetchMyGoshuin = fetchMyGoshuin as unknown as Mock;
const mockDeleteMyGoshuin = deleteMyGoshuin as unknown as Mock;
const mockUpdateMyGoshuinVisibility = updateMyGoshuinVisibility as unknown as Mock;

type HookValue = {
  items: Goshuin[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void> | void;
  addItem: (g: Goshuin) => void;
  removeItem: (id: number) => Promise<void> | void;
  toggleVisibility: (id: number) => Promise<void> | void;
  
};

function HookTester({ onReady }: { onReady: (value: HookValue) => void }) {
  const hook = useMyGoshuin();

  useEffect(() => {
    onReady(hook);
  }, [hook, onReady]);

  return null;
}

describe("useMyGoshuin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("初回ロードで fetchMyGoshuin の結果が items に入る", async () => {
    const sample: Goshuin[] = [
      {
        id: 1,
        shrine: 1,
        is_public: true,
        shrine_name: "テスト神社",
        image_url: "https://example.com/goshuin1.png",
      },
    ];

    mockFetchMyGoshuin.mockResolvedValue(sample);

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });

    expect(mockFetchMyGoshuin).toHaveBeenCalledTimes(1);
    expect(latest.items).toEqual(sample);
    expect(latest.error).toBeNull();
  });

  it("ロード失敗時には error メッセージがセットされ、loading が false になる", async () => {
    mockFetchMyGoshuin.mockRejectedValue(new Error("network error"));

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });

    expect(mockFetchMyGoshuin).toHaveBeenCalledTimes(1);
    expect(latest.items).toBeNull();
    expect(latest.error).toBe("御朱印一覧の取得に失敗しました。");
  });

  it("addItem は items が null のとき新しい配列を作り、その後は先頭に追加する", async () => {
    mockFetchMyGoshuin.mockRejectedValue(new Error("network error"));

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });

    const first: Goshuin = {
      id: 1,
      shrine: 1,
      is_public: true,
      shrine_name: "一枚目",
    };

    const second: Goshuin = {
      id: 2,
      shrine: 2,
      is_public: true,
      shrine_name: "二枚目",
    };

    act(() => {
      latest.addItem(first);
    });
    expect(latest.items).toEqual([first]);

    act(() => {
      latest.addItem(second);
    });
    expect(latest.items).toEqual([second, first]);
  });

  it("removeItem 成功時は deleteMyGoshuin が呼ばれ、items から対象が消える", async () => {
    const sample: Goshuin[] = [
      { id: 1, shrine: 1, is_public: true, shrine_name: "削除対象" },
      { id: 2, shrine: 2, is_public: true, shrine_name: "残る方" },
    ];

    mockFetchMyGoshuin.mockResolvedValue(sample);
    mockDeleteMyGoshuin.mockResolvedValue(undefined);

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });

    expect(latest.items).toHaveLength(2);

    await act(async () => {
      await latest.removeItem(1);
    });

    expect(mockDeleteMyGoshuin).toHaveBeenCalledWith(1);
    expect(latest.items).toEqual([sample[1]]);
    expect(latest.error).toBeNull();
  });

  it("removeItem 失敗時は items をロールバックし、エラーメッセージをセットする", async () => {
    const sample: Goshuin[] = [{ id: 1, shrine: 1, is_public: true, shrine_name: "削除対象" }];

    mockFetchMyGoshuin.mockResolvedValue(sample);
    mockDeleteMyGoshuin.mockRejectedValue(new Error("delete failed"));

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });

    await act(async () => {
      await latest.removeItem(1);
    });

    expect(mockDeleteMyGoshuin).toHaveBeenCalledWith(1);
    expect(latest.items).toEqual(sample);
    expect(latest.error).toBe("削除に失敗しました。時間をおいて再度お試しください。");
  });

  it("toggleVisibility 成功時は is_public が反転し、API も呼ばれる", async () => {
    const sample: Goshuin[] = [{ id: 1, shrine: 1, is_public: true, shrine_name: "公開中" }];

    mockFetchMyGoshuin.mockResolvedValue(sample);
    mockUpdateMyGoshuinVisibility.mockResolvedValue({
      ...sample[0],
      is_public: false,
    });

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });

    await act(async () => {
      await latest.toggleVisibility(1);
    });

    expect(mockUpdateMyGoshuinVisibility).toHaveBeenCalledWith(1, false);
    expect(latest.items?.[0].is_public).toBe(false);
    expect(latest.error).toBeNull();
  });

  it("toggleVisibility 失敗時は is_public をロールバックし、エラーメッセージをセットする", async () => {
    const sample: Goshuin[] = [{ id: 1, shrine: 1, is_public: true, shrine_name: "公開中" }];

    mockFetchMyGoshuin.mockResolvedValue(sample);
    mockUpdateMyGoshuinVisibility.mockRejectedValue(new Error("update failed"));

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });

    await act(async () => {
      await latest.toggleVisibility(1);
    });

    // ロールバックされて公開のまま
    expect(latest.items).toEqual(sample);
    expect(latest.error).toBe("公開設定の更新に失敗しました。時間をおいて再度お試しください。");
  });
});
