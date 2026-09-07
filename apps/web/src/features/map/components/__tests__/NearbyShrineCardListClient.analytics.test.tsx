import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { trackNearbyFetch } from "@/lib/analytics/searchEvents";
import NearbyShrineCardListClient from "../NearbyShrineCardListClient";

const mockSearchParams = new Map<string, string>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

vi.mock("@/lib/analytics/searchEvents", () => ({
  trackNearbyFetch: vi.fn(),
}));

const trackNearbyFetchMock = vi.mocked(trackNearbyFetch);

const readyResult = {
  results: [
    {
      place_id: "p1",
      name: "テスト神社",
      address: "東京都千代田区",
      lat: 35.681236,
      lng: 139.767125,
    },
  ],
};

function mockGeolocationSuccess() {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: {
            latitude: 35.681236,
            longitude: 139.767125,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }),
    },
  });
}

function mockGeolocationError(code: number) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({ code, message: "x" } as GeolocationPositionError);
      }),
    },
  });
}

function mockFetchReady() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => readyResult,
    }),
  );
}

function mockFetchEmpty() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }),
  );
}

async function flushPendingUpdatesAndEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForInitialNearbyFetch() {
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(trackNearbyFetchMock).toHaveBeenCalledTimes(1);
  });
}

describe("NearbyShrineCardListClient nearby_fetch analytics", () => {
  beforeEach(() => {
    mockSearchParams.clear();
    trackNearbyFetchMock.mockReset();
    mockGeolocationSuccess();
    mockFetchEmpty();
  });

  it("device locationの初回actual fetchをauto / fallback=falseで1回だけ記録する", async () => {
    render(<NearbyShrineCardListClient />);

    await waitForInitialNearbyFetch();

    expect(trackNearbyFetchMock).toHaveBeenCalledWith({
      source: "map",
      surface: "web",
      trigger: "auto",
      used_fallback: false,
    });
  });

  it("geolocation失敗時の東京駅fallback fetchをfallback=trueで記録する", async () => {
    mockGeolocationError(1);
    render(<NearbyShrineCardListClient />);

    expect(await screen.findByText("現在地が取れないため仮の場所（東京駅）で検索中")).toBeInTheDocument();
    await waitForInitialNearbyFetch();

    expect(trackNearbyFetchMock).toHaveBeenCalledWith({
      source: "map",
      surface: "web",
      trigger: "auto",
      used_fallback: true,
    });
  });

  it("same-keyの通常rerenderではfetchもnearby_fetchも増えない", async () => {
    const { rerender } = render(<NearbyShrineCardListClient />);
    await waitForInitialNearbyFetch();

    rerender(<NearbyShrineCardListClient />);
    await flushPendingUpdatesAndEffects();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(trackNearbyFetchMock).toHaveBeenCalledTimes(1);
  });

  it("manual refreshでは2件目をmanual_refreshとして記録する", async () => {
    mockFetchReady();
    render(<NearbyShrineCardListClient />);

    expect(await screen.findByText("テスト神社")).toBeInTheDocument();
    await waitForInitialNearbyFetch();

    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(trackNearbyFetchMock).toHaveBeenCalledTimes(2);
    });
    expect(trackNearbyFetchMock).toHaveBeenNthCalledWith(2, {
      source: "map",
      surface: "web",
      trigger: "manual_refresh",
      used_fallback: false,
    });
  });

  it("ready→manual refresh→emptyでも自動3回目を記録しない", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => readyResult })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) }),
    );

    render(<NearbyShrineCardListClient />);
    expect(await screen.findByText("テスト神社")).toBeInTheDocument();
    await waitForInitialNearbyFetch();

    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    expect(await screen.findByText("近くに候補が見つかりませんでした。")).toBeInTheDocument();
    await flushPendingUpdatesAndEffects();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(trackNearbyFetchMock).toHaveBeenCalledTimes(2);
  });

  it("ready→manual refresh→errorでも自動3回目を記録しない", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => readyResult })
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    );

    render(<NearbyShrineCardListClient />);
    expect(await screen.findByText("テスト神社")).toBeInTheDocument();
    await waitForInitialNearbyFetch();

    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    expect(await screen.findByText("情報の取得に失敗しました。")).toBeInTheDocument();
    await flushPendingUpdatesAndEffects();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(trackNearbyFetchMock).toHaveBeenCalledTimes(2);
  });

  it("tid変更でactual fetchが起きた場合は2件目もautoとして記録する", async () => {
    mockFetchReady();
    const { rerender } = render(<NearbyShrineCardListClient />);

    expect(await screen.findByText("テスト神社")).toBeInTheDocument();
    await waitForInitialNearbyFetch();

    mockSearchParams.set("tid", "tid-changed");
    rerender(<NearbyShrineCardListClient />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(trackNearbyFetchMock).toHaveBeenCalledTimes(2);
    });
    expect(trackNearbyFetchMock).toHaveBeenNthCalledWith(2, {
      source: "map",
      surface: "web",
      trigger: "auto",
      used_fallback: false,
    });
  });

  it("Googleマップ外部リンク操作ではnearby_fetchを追加発火しない", async () => {
    mockFetchReady();
    render(<NearbyShrineCardListClient />);

    expect(await screen.findByText("テスト神社")).toBeInTheDocument();
    await waitForInitialNearbyFetch();

    fireEvent.click(screen.getByRole("link", { name: "経路案内" }));
    await flushPendingUpdatesAndEffects();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(trackNearbyFetchMock).toHaveBeenCalledTimes(1);
  });
});
