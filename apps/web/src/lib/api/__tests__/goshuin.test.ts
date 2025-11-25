// apps/web/src/lib/api/__tests__/goshuin.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import api from "../client";
import {
  fetchPublicGoshuin,
  fetchMyGoshuin,
  getGoshuinPublicAuto,
  getMyGoshuinAuto,
  getGoshuin,
  getGoshuinAuto,
} from "../goshuin";

// api クライアントだけモックする
vi.mock("../client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const apiGetMock = api.get as unknown as ReturnType<typeof vi.fn>;
const apiPostMock = api.post as unknown as ReturnType<typeof vi.fn>;

describe("goshuin api client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetchPublicGoshuin は /goshuin/ を叩いて結果を返す", async () => {
    apiGetMock.mockResolvedValue({ data: [{ id: 1 }] });

    const res = await fetchPublicGoshuin();

    expect(apiGetMock).toHaveBeenCalledWith("/goshuin/");
    expect(res).toEqual([{ id: 1 }]);
  });

  it("fetchMyGoshuin は /my/goshuin/ を叩いて結果を返す", async () => {
    apiGetMock.mockResolvedValue({ data: [{ id: 2 }] });

    const res = await fetchMyGoshuin();

    expect(apiGetMock).toHaveBeenCalledWith("/my/goshuin/");
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

  it("getMyGoshuinAuto は 404 しか返らない場合、最終的に空配列を返す", async () => {
    apiGetMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await getMyGoshuinAuto();

    expect(apiGetMock).toHaveBeenCalledTimes(3); // CANDIDATES の数ぶん
    expect(res).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
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
});
