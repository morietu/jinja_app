import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

vi.mock("@/lib/server/bffFetch", () => ({
  bffFetchWithAuthFromReq: vi.fn(),
}));

import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

function createRequest(body: unknown) {
  return {
    text: async () => JSON.stringify(body),
  } as any;
}

describe("POST /api/compass/weekly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: bodyをそのまま /api/compass/weekly/ へ転送する", async () => {
    const mockResponse = { ok: true, status: 200, json: async () => ({ state: "weekly_success" }) };
    (bffFetchWithAuthFromReq as any).mockResolvedValue(mockResponse);

    const body = { purpose: "career", birthdate: "1990-01-01", origin: { lat: 35, lng: 139 } };
    const res = await POST(createRequest(body));

    expect(bffFetchWithAuthFromReq).toHaveBeenCalledWith(
      expect.anything(),
      "/api/compass/weekly/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(res).toBe(mockResponse);
  });

  it("upstreamのレスポンス（status/body）をそのまま返す", async () => {
    const mockResponse = { ok: false, status: 400, json: async () => ({ state: "invalid_purpose" }) };
    (bffFetchWithAuthFromReq as any).mockResolvedValue(mockResponse);

    const res = await POST(createRequest({ purpose: "not_real" }));

    expect(res).toBe(mockResponse);
    expect((res as any).status).toBe(400);
    expect(await (res as any).json()).toEqual({ state: "invalid_purpose" });
  });

  it("Weekly独自のJWT/Cookie処理を持たず、既存BFF helperだけを使う", async () => {
    const mockResponse = { ok: true, status: 200, json: async () => ({}) };
    (bffFetchWithAuthFromReq as any).mockResolvedValue(mockResponse);

    await POST(createRequest({ purpose: "career" }));

    expect(bffFetchWithAuthFromReq).toHaveBeenCalledTimes(1);
    const [, , init] = (bffFetchWithAuthFromReq as any).mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    // Authorization / Cookie をroute側で組み立てない。
    expect(Object.keys(init.headers)).not.toContain("Authorization");
    expect(Object.keys(init.headers)).not.toContain("Cookie");
  });
});
