import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAnalyticsProvider } from "@/lib/analytics/providers";
import { trackNearbyFetch } from "@/lib/analytics/searchEvents";

vi.mock("@/lib/analytics/providers", () => ({
  getAnalyticsProvider: vi.fn(),
}));

const mockedGetAnalyticsProvider = vi.mocked(getAnalyticsProvider);

describe("nearby_fetch analytics contract", () => {
  const trackMock = vi.fn();

  beforeEach(() => {
    trackMock.mockReset();
    mockedGetAnalyticsProvider.mockReturnValue({ track: trackMock });
  });

  it("nearby_fetchの許可済み最小payloadだけを送る", () => {
    trackNearbyFetch({
      source: "map",
      surface: "web",
      trigger: "manual_refresh",
      used_fallback: true,
    });

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("nearby_fetch", {
      source: "map",
      surface: "web",
      trigger: "manual_refresh",
      used_fallback: true,
    });

    const [, payload] = trackMock.mock.calls[0] ?? [];
    expect(payload).not.toHaveProperty("latitude");
    expect(payload).not.toHaveProperty("longitude");
    expect(payload).not.toHaveProperty("query");
    expect(payload).not.toHaveProperty("threadId");
    expect(payload).not.toHaveProperty("user_id");
    expect(payload).not.toHaveProperty("distinct_id");
    expect(payload).not.toHaveProperty("place_id");
  });

  it("analytics providerがthrowしても呼び出し元へ例外を伝播しない", () => {
    trackMock.mockImplementation(() => {
      throw new Error("analytics unavailable");
    });

    expect(() =>
      trackNearbyFetch({
        source: "map",
        surface: "web",
        trigger: "auto",
        used_fallback: false,
      }),
    ).not.toThrow();
  });
});
