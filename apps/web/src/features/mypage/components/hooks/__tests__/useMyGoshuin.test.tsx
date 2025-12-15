// apps/web/src/features/mypage/components/hooks/__tests__/useMyGoshuin.test.tsx
import React, { useEffect } from "react";
import { render, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { AxiosError } from "axios";
import { useMyGoshuin } from "../useMyGoshuin";
import type { Goshuin } from "@/lib/api/goshuin";

// goshuin API をモック
vi.mock("@/lib/api/goshuin", () => {
  return {
    fetchMyGoshuin: vi.fn(),
    uploadMyGoshuin: vi.fn(),
    deleteMyGoshuin: vi.fn(),
    updateMyGoshuinVisibility: vi.fn(),
  };
});


import { fetchMyGoshuin, uploadMyGoshuin, deleteMyGoshuin, updateMyGoshuinVisibility } from "@/lib/api/goshuin";

const mockFetchMyGoshuin = fetchMyGoshuin as unknown as Mock;
const mockUploadMyGoshuin = uploadMyGoshuin as unknown as Mock;
const mockDeleteMyGoshuin = deleteMyGoshuin as unknown as Mock;
const mockUpdateMyGoshuinVisibility = updateMyGoshuinVisibility as unknown as Mock;

type HookValue = {
  items: Goshuin[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void> | void;
  upload: (input: { shrineId: number; title: string; isPublic: boolean; file: File }) => Promise<Goshuin | null>;
  addItem: (g: Goshuin) => void;
  removeItem: (id: number) => Promise<void> | void;
  toggleVisibility: (id: number, next: boolean) => Promise<void>;
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

  it("upload: PLAN_LIMIT_EXCEEDED(403) のときは null を返し、制限メッセージをセットする", async () => {
    // 初回ロードは空でOK（upload だけ見たい）
    mockFetchMyGoshuin.mockResolvedValue([]);

    
    const err = {
      isAxiosError: true,
      config: {}, // ← 追加（これがあると “っぽさ” が増して安全）
      response: {
        status: 403,
        data: { code: "PLAN_LIMIT_EXCEEDED", limit: 10, detail: "御朱印は最大 10 件までです。" },
      },
    } as unknown as AxiosError;
    mockUploadMyGoshuin.mockRejectedValue(err);
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

    const file = new File(["dummy"], "a.jpg", { type: "image/jpeg" });

    let result: Goshuin | null = null;
    await act(async () => {
      result = await latest.upload({
        shrineId: 1,
        title: "t",
        isPublic: true,
        file,
      });
    });

    expect(result).toBeNull();
    expect(latest.error).toBe("御朱印は最大10件までです。不要な御朱印を削除してから追加してください。");
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

  it("reload 成功時は最新の items で上書きされ、error は null のままになる", async () => {
    const initial: Goshuin[] = [{ id: 1, shrine: 1, is_public: true, shrine_name: "初回" }];
    const reloaded: Goshuin[] = [{ id: 2, shrine: 2, is_public: true, shrine_name: "リロード後" }];

    // 初回ロード → initial
    mockFetchMyGoshuin.mockResolvedValueOnce(initial);

    let latest = {} as HookValue;

    render(
      <HookTester
        onReady={(v) => {
          latest = v;
        }}
      />,
    );

    // 初回ロード完了待ち
    await waitFor(() => {
      expect(latest.loading).toBe(false);
    });
    expect(latest.items).toEqual(initial);

    // reload 用に mock を差し替え
    mockFetchMyGoshuin.mockResolvedValueOnce(reloaded);

    await act(async () => {
      await latest.reload();
    });

    expect(mockFetchMyGoshuin).toHaveBeenCalledTimes(2);
    expect(latest.items).toEqual(reloaded);
    expect(latest.loading).toBe(false);
    expect(latest.error).toBeNull();
  });

  it("reload 失敗時は items を null にし、エラーメッセージをセットする", async () => {
    const initial: Goshuin[] = [{ id: 1, shrine: 1, is_public: true, shrine_name: "初回" }];

    // 初回ロードは成功
    mockFetchMyGoshuin.mockResolvedValueOnce(initial);

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
    expect(latest.items).toEqual(initial);

    // reload 用：今度は失敗させる
    mockFetchMyGoshuin.mockRejectedValueOnce(new Error("reload failed"));

    await act(async () => {
      await latest.reload();
    });

    expect(mockFetchMyGoshuin).toHaveBeenCalledTimes(2);
    expect(latest.items).toBeNull();
    expect(latest.loading).toBe(false);
    expect(latest.error).toBe("御朱印一覧の取得に失敗しました。");
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
      // 現在の状態（true）から false に反転
      await latest.toggleVisibility(1, false);
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
      // 現在の状態（true）から false に反転を試みる
      await latest.toggleVisibility(1, false);
    });

    // ロールバックされて公開のまま
    expect(latest.items).toEqual(sample);
    expect(latest.error).toBe("公開設定の更新に失敗しました。時間をおいて再度お試しください。");
  });
});
