// apps/web/src/lib/api/__tests__/goshuin.test.ts

import axios from "axios";
import api from "../client";
import {
  fetchPublicGoshuin,
  fetchMyGoshuin,
  getGoshuinPublicAuto,
  getMyGoshuinAuto,
  getGoshuin,
  getGoshuinAuto,
  updateMyGoshuinVisibility,
} from "../goshuin";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("../client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));


const apiGetMock = api.get as unknown as Mock;
const apiPatch = api.patch as unknown as Mock;

describe("goshuin api client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetchPublicGoshuin は /goshuins/ を叩いて結果を返す", async () => {
    apiGetMock.mockResolvedValue({ data: [{ id: 1 }] });

    const res = await fetchPublicGoshuin();

    expect(apiGetMock).toHaveBeenCalledWith("/goshuins/");
    expect(res).toEqual([{ id: 1 }]);
  });

  it("fetchMyGoshuin は /my/goshuins/ を叩いて結果を返す", async () => {
    apiGetMock.mockResolvedValue({ data: [{ id: 2 }] });

    const res = await fetchMyGoshuin();

    // ✅ 実装に合わせて singular に変更
    expect(apiGetMock).toHaveBeenCalledWith("/my/goshuins/");
    expect(res).toEqual([{ id: 2 }]);
  });

  it("getGoshuinPublicAuto は最初の候補 URL で成功したらその結果を返す", async () => {
    apiGetMock.mockResolvedValue({ data: [{ id: 10 }] });

    const res = await getGoshuinPublicAuto();

    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(res).toEqual([{ id: 10 }]);
  });

  it("getGoshuinPublicAuto は 404 の場合、次候補へ進み成功した結果を返す", async () => {
    apiGetMock
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 404 },
      })
      .mockResolvedValueOnce({ data: [{ id: 20 }] });

    const res = await getGoshuinPublicAuto();

    expect(apiGetMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual([{ id: 20 }]);
  });

  it("getGoshuinPublicAuto はレスポンスなしの AxiosError の場合、絶対URLで axios.get を叩く", async () => {
    apiGetMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: undefined,
    });

    const axiosSpy = vi.spyOn(axios, "get").mockResolvedValueOnce({ data: [{ id: 30 }] } as any);

    const res = await getGoshuinPublicAuto();

    expect(axiosSpy).toHaveBeenCalledTimes(1);
    expect(res).toEqual([{ id: 30 }]);
  });

  it("getGoshuinPublicAuto は 401/403 の場合は空配列を返す", async () => {
    apiGetMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    const res = await getGoshuinPublicAuto();

    expect(res).toEqual([]);
  });

  it("getMyGoshuinAuto は 401 の場合、空配列を返す", async () => {
    apiGetMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    const res = await getMyGoshuinAuto();

    expect(res).toEqual([]);
  });

  it("getMyGoshuinAuto は 404 の場合、空配列を返し warn する", async () => {
    const isAxiosSpy = vi.spyOn(axios, "isAxiosError").mockReturnValue(true);

    apiGetMock.mockRejectedValueOnce({ response: { status: 404 } });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await getMyGoshuinAuto();

    // 「何回試すか」ではなく「最低限こうなる」を保証する
    expect(apiGetMock).toHaveBeenCalledTimes(1);
    expect(apiGetMock).toHaveBeenCalledWith("/my/goshuins/");
    expect(res).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    isAxiosSpy.mockRestore();
  });

  it("getMyGoshuinAuto はネットワークエラー（response なし）の場合も空配列を返す", async () => {
    apiGetMock.mockRejectedValue({
      isAxiosError: true,
      response: undefined,
    });

    const res = await getMyGoshuinAuto();

    expect(res).toEqual([]);
  });

  it("エイリアス getGoshuin / getGoshuinAuto も getGoshuinPublicAuto をラップしている", async () => {
    apiGetMock.mockResolvedValue({ data: [{ id: 99 }] });

    const res1 = await getGoshuin();
    const res2 = await getGoshuinAuto();

    expect(res1).toEqual([{ id: 99 }]);
    expect(res2).toEqual([{ id: 99 }]);
  });

  it("getGoshuinPublicAuto は AxiosError でない例外でも空配列を返す", async () => {
    // AxiosError ではない Error を投げるケース
    apiGetMock.mockRejectedValue(new Error("boom"));

    const res = await getGoshuinPublicAuto();

    expect(res).toEqual([]);
  });

  it("getGoshuinPublicAuto は 500 などの非 404/401/403 Axios エラーでも空配列を返す", async () => {
    apiGetMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });

    const res = await getGoshuinPublicAuto();

    expect(res).toEqual([]);
  });
});


describe("updateMyGoshuinVisibility", () => {
  beforeEach(() => {
    apiPatch.mockReset();
  });

  it("指定 ID の御朱印の is_public を更新して結果を返す", async () => {
    const updated = { id: 1, is_public: true };
    apiPatch.mockResolvedValue({ data: updated });

    const result = await updateMyGoshuinVisibility(1, true);

    // ✅ singular + 末尾スラッシュ付きに変更（実装の呼び出しに合わせる）
    expect(apiPatch).toHaveBeenCalledWith("/my/goshuins/1/", { is_public: true });
    expect(result).toEqual(updated);
  });
});
