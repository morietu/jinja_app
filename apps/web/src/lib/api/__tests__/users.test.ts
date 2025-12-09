// src/lib/api/__tests__/users.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosInstance } from "axios";

vi.mock("../client", () => {
  const get = vi.fn();
  const post = vi.fn();
  const patch = vi.fn();

  const api = {
    get,
    post,
    patch,
  } as unknown as AxiosInstance;

  return {
    __esModule: true,
    default: api,
  };
});

import api from "../client";
import { getCurrentUser, updateUser, uploadUserIcon } from "../users";

const mockedApi = vi.mocked(api, { deep: true });

describe("users api client", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.patch.mockReset();
  });

  // ここに updateMe のテストがあればそのままでOK（省略）

  it("uploadUserIcon は FormData で users/me/icon/ に POST する", async () => {
    const file = new File(["dummy"], "icon.png", { type: "image/png" });

    mockedApi.post.mockResolvedValue({ data: { icon_url: "/media/icon.png" } });

    await uploadUserIcon(file);

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, formData, config] = mockedApi.post.mock.calls[0];

    expect(url).toBe("users/me/icon/");
    expect(formData).toBeInstanceOf(FormData);
    // axios に任せるのでヘッダーは undefined でOK
    expect(config?.headers?.["Content-Type"]).toBeUndefined();
  });

  it("getCurrentUser は /api/users/me/ から現在のユーザー情報を取得する", async () => {
    const me = { id: 1, username: "test-user" };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue(me),
    } as any);

    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    const result = await getCurrentUser();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/users/me/",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: undefined,
      }),
    );
    expect(result).toEqual(me);

    global.fetch = originalFetch;
  });

  it("getCurrentUser は 401 のとき null を返す", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      text: vi.fn().mockResolvedValue(""),
    } as any);

    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    const result = await getCurrentUser();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();

    global.fetch = originalFetch;
  });

  it("updateUser は /api/users/me/ に PATCH して成功時に User を返す", async () => {
    const patch = { nickname: "patched" };
    const me = { id: 1, username: "test-user", nickname: "patched" };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(me),
    } as any);

    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    const result = await updateUser(patch);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/users/me/",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );
    expect(result).toEqual(me);

    global.fetch = originalFetch;
  });

  it("updateUser はエラー時に message 文言で throw する", async () => {
    const patch = { nickname: "patched" };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("server error"),
    } as any);

    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    await expect(updateUser(patch)).rejects.toThrow("server error");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    global.fetch = originalFetch;
  });
});
