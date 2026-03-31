import { describe, it, expect, vi, beforeEach, beforeAll, type Mock } from "vitest";

// ✅ vitest.setup.ts の global mock を、このファイルでは解除
vi.unmock("@/lib/api/goshuin");
vi.unmock("../goshuin");

// ✅ client はこのテストでは引き続きモック（api.get/patch の呼び出し検証のため）
vi.mock("../client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

let api: any;
let fetchPublicGoshuin: any;
let fetchMyGoshuin: any;
let updateMyGoshuinVisibility: any;

beforeAll(async () => {
  api = (await import("../client")).default;

  const mod = await import("../goshuin");
  fetchPublicGoshuin = mod.fetchPublicGoshuin;
  fetchMyGoshuin = mod.fetchMyGoshuin;
  updateMyGoshuinVisibility = mod.updateMyGoshuinVisibility;
});

const apiGetMock = () => api.get as unknown as Mock;
const apiPatch = () => api.patch as unknown as Mock;

describe("goshuin api client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetchPublicGoshuin は /goshuins/ を叩いて結果を返す", async () => {
    apiGetMock().mockResolvedValue({ data: [{ id: 1 }] });

    const res = await fetchPublicGoshuin();

    expect(apiGetMock()).toHaveBeenCalledWith("/goshuins/");
    expect(res).toEqual([{ id: 1 }]);
  });

  it("fetchMyGoshuin は /my/goshuins/ を叩いて結果を返す", async () => {
    apiGetMock().mockResolvedValue({ data: [{ id: 2 }] });

    const res = await fetchMyGoshuin();

    expect(apiGetMock()).toHaveBeenCalledWith("/my/goshuins/");
    expect(res).toEqual([{ id: 2 }]);
  });
});

describe("updateMyGoshuinVisibility", () => {
  beforeEach(() => {
    apiPatch().mockReset();
  });

  it("指定 ID の御朱印の is_public を更新して結果を返す", async () => {
    const updated = { id: 1, is_public: true };
    apiPatch().mockResolvedValue({ data: updated });

    const result = await updateMyGoshuinVisibility(1, true);

    expect(apiPatch()).toHaveBeenCalledWith("/my/goshuins/1/", { is_public: true });
    expect(result).toEqual(updated);
  });
});

it("fetchPublicGoshuin: results を配列化して返す", async () => {
  apiGetMock().mockResolvedValue({ data: { results: [{ id: 10 }] } });

  const res = await fetchPublicGoshuin();

  expect(res).toEqual([{ id: 10 }]);
});

it("fetchPublicGoshuin: 不正な shape は空配列を返す", async () => {
  apiGetMock().mockResolvedValue({ data: { foo: "bar" } });

  const res = await fetchPublicGoshuin();

  expect(res).toEqual([]);
});

it("uploadMyGoshuin: shrineId なしでも送信できる", async () => {
  const { uploadMyGoshuin } = await import("../goshuin");
  (api.post as Mock).mockResolvedValue({ data: { id: 1 } });

  const file = new File(["x"], "test.png", { type: "image/png" });
  const res = await uploadMyGoshuin({
    title: "御朱印",
    isPublic: false,
    file,
  });

  expect(api.post).toHaveBeenCalledWith("/my/goshuins/", expect.any(FormData));
  expect(res).toEqual({ id: 1 });
});
