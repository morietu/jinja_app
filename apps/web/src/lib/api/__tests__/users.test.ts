// src/lib/api/__tests__/users.test.ts
import { describe, it, expect, vi } from "vitest";

import { updateUser } from "../users";

describe("users api client", () => {
  it("updateUser は /api/users/me/ に PATCH して成功時に User を返す", async () => {
    const patch = { nickname: "patched" };
    const me = {
      id: 1,
      username: "test-user",
      email: "test@example.com",
      first_name: "",
      last_name: "",
      profile: {
        nickname: "patched",
        is_public: true,
        bio: null,
        icon: null,
        icon_url: null,
        birthday: null,
        birth_time: null,
        birth_place: null,
        created_at: "2026-09-06T00:00:00Z",
      },
    };

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
