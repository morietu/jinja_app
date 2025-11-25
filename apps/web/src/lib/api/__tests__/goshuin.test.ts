import { describe, it, expect, vi } from "vitest";
import api from "../client";
import axios from "axios";
import { fetchPublicGoshuin, fetchMyGoshuin, getGoshuinPublicAuto, getMyGoshuinAuto } from "../goshuin";

vi.mock("../client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("axios");

describe("goshuin api", () => {
  it("fetchPublicGoshuin が /goshuin/ を叩く", async () => {
    (api.get as any).mockResolvedValue({ data: [{ id: 1 }] });

    const res = await fetchPublicGoshuin();
    expect(api.get).toHaveBeenCalledWith("/goshuin/");
    expect(res).toEqual([{ id: 1 }]);
  });

  it("fetchMyGoshuin が /my/goshuin/ を叩く", async () => {
    (api.get as any).mockResolvedValue({ data: [{ id: 2 }] });

    const res = await fetchMyGoshuin();
    expect(api.get).toHaveBeenCalledWith("/my/goshuin/");
    expect(res).toEqual([{ id: 2 }]);
  });

  it("getGoshuinPublicAuto が候補 URL を順番に試す", async () => {
    (api.get as any).mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValueOnce({ data: [{ id: 3 }] });

    const res = await getGoshuinPublicAuto();
    expect(res).toEqual([{ id: 3 }]);
  });

  it("getMyGoshuinAuto で 401/403 は空配列になる", async () => {
    (api.get as any).mockRejectedValue({ response: { status: 401 } });

    const res = await getMyGoshuinAuto();
    expect(res).toEqual([]);
  });
});
