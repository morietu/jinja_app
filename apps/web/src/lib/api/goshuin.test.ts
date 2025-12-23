// apps/web/src/lib/api/goshuin.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchMyGoshuin, uploadMyGoshuin, type Goshuin } from "./goshuin";

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("./client", () => ({
  default: {
    get: getMock,
    post: postMock,
  },
}));

describe("goshuin api client (simple tests)", () => {
  it("fetchMyGoshuin は /my/goshuins/ を叩く", async () => {
    getMock.mockResolvedValue({ data: [{ id: 1 }] as Goshuin[] });

    const res = await fetchMyGoshuin();

    expect(getMock).toHaveBeenCalledWith("/my/goshuins/");
    expect(res).toEqual([{ id: 1 }]);
  });

  it("uploadMyGoshuin は /my/goshuins/ を叩き、FormData を送る", async () => {
    const dummyFile = {} as File; // 中身はモックなので空でOK

    postMock.mockResolvedValue({ data: { id: 1 } as Goshuin });

    const res = await uploadMyGoshuin({
      shrineId: 1,
      title: "テスト",
      isPublic: true,
      file: dummyFile,
    });

    expect(postMock).toHaveBeenCalledTimes(1);

    const [url, body] = postMock.mock.calls[0];

    // URL が正しいこと
    expect(url).toBe("/my/goshuins/");

    // 第二引数が FormData であることだけ確認（中身までは見ない）
    expect(body).toBeInstanceOf(FormData);

    expect(res).toEqual({ id: 1 });
  });
});
