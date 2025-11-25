// apps/web/src/lib/api/goshuin.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchMyGoshuin, uploadMyGoshuin } from "./goshuin";

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("./client", () => ({
  default: {
    get: getMock,
    post: postMock,
  },
}));

describe("goshuin api client", () => {
  it("fetchMyGoshuin は /my/goshuin/ を叩く", async () => {
    getMock.mockResolvedValue({ data: [{ id: 1 }] });

    const res = await fetchMyGoshuin();
    expect(getMock).toHaveBeenCalledWith("/my/goshuin/");
    expect(res).toEqual([{ id: 1 }]);
  });

  it("uploadMyGoshuin は /my/goshuin/ を叩く", async () => {
    const form = new FormData();
    postMock.mockResolvedValue({ data: { id: 1 } });

    const res = await uploadMyGoshuin(form);
    expect(postMock).toHaveBeenCalledWith("/my/goshuin/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    expect(res).toEqual({ id: 1 });
  });
});
