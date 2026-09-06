import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import NearbyShrineCardListClient from "../NearbyShrineCardListClient";

const mockSearchParams = new Map<string, string>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

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
      getCurrentPosition: vi.fn(
        (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({ code, message: "x" } as GeolocationPositionError);
        },
      ),
    },
  });
}

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

function mockFetchError() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }),
  );
}

async function waitForNearbyFetch() {
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/places/nearby?"), expect.any(Object));
  });
}

async function flushPendingUpdatesAndEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("NearbyShrineCardListClient", () => {
  beforeEach(() => {
    mockSearchParams.clear();
    mockGeolocationSuccess();
    mockFetchEmpty();
  });

  describe("automatic fetch dedupe (同一 request key)", () => {
    it("1. 初回ready → fetch合計1回", async () => {
      mockFetchReady();
      render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("テスト神社")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("2. 初回empty → fetch合計1回", async () => {
      render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("近くに候補が見つかりませんでした。")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("3. 初回error → fetch合計1回", async () => {
      mockFetchError();
      render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("情報の取得に失敗しました。")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("4. ready後の通常rerender → 追加0回", async () => {
      mockFetchReady();
      const { rerender } = render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("テスト神社")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);

      rerender(<NearbyShrineCardListClient />);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("5. ready → 更新 → ready → 合計2回", async () => {
      mockFetchReady();
      render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("テスト神社")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "更新" }));
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });

    it("6. ready → 更新 → empty → 合計2回、自動3回目なし", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => readyResult,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ results: [] }),
          }),
      );

      render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("テスト神社")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "更新" }));
      expect(await screen.findByText("近くに候補が見つかりませんでした。")).toBeInTheDocument();
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      await flushPendingUpdatesAndEffects();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("7. ready → 更新 → error → 合計2回、自動3回目なし", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => readyResult,
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
          }),
      );

      render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("テスト神社")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "更新" }));
      expect(await screen.findByText("情報の取得に失敗しました。")).toBeInTheDocument();
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      await flushPendingUpdatesAndEffects();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("8. geolocation失敗 → 東京駅fallback → fetch合計1回", async () => {
      mockGeolocationError(1);
      render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("現在地が取れないため仮の場所（東京駅）で検索中")).toBeInTheDocument();
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining("lat=35.681236"), expect.any(Object));
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("9. tid変更 → 別request keyとして新規fetch 1回、合計2回", async () => {
      mockFetchReady();
      const { rerender } = render(<NearbyShrineCardListClient />);

      expect(await screen.findByText("テスト神社")).toBeInTheDocument();
      await waitForNearbyFetch();
      expect(fetch).toHaveBeenCalledTimes(1);

      mockSearchParams.set("tid", "tid-changed");
      rerender(<NearbyShrineCardListClient />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });
      await flushPendingUpdatesAndEffects();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("empty 状態で登録がない可能性の文言と神社追加リンクを表示する", async () => {
    render(<NearbyShrineCardListClient />);

    expect(await screen.findByText("近くに候補が見つかりませんでした。")).toBeInTheDocument();
    expect(screen.getByText("この場所にはまだ登録がない可能性があります。")).toBeInTheDocument();

    const addLink = screen.getByRole("link", { name: "神社を追加する" });
    expect(addLink).toHaveAttribute("href", "/shrines/new?returnTo=/map");
    expect(screen.getByRole("link", { name: "Googleマップで探す" })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/places/nearby?"), expect.any(Object));
    });
  });

  it("submitted=1 かつ status=pending のとき submission 受付バナーを表示する", async () => {
    mockSearchParams.set("submitted", "1");
    mockSearchParams.set("status", "pending");
    mockSearchParams.set("name", "テスト神社");

    render(<NearbyShrineCardListClient />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /「テスト神社」の投稿を受け付けました。\s*現在審査中のため、公開検索にはまだ表示されません。\s*審査完了後に公開されます。/,
    );
    expect(await screen.findByText("近くに候補が見つかりませんでした。")).toBeInTheDocument();
  });

  it.each([[1], [2], [3]])(
    "geolocation error(code %i) では東京駅 fallback で検索を継続し、crash / loading 永久化しない (RH3-4b)",
    async (code) => {
      mockGeolocationError(code);

      render(<NearbyShrineCardListClient />);

      // fail-safe: fallback (東京駅) の告知が出る & 検索は継続する
      expect(await screen.findByText("現在地が取れないため仮の場所（東京駅）で検索中")).toBeInTheDocument();
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("lat=35.681236"),
          expect.any(Object),
        );
      });
      expect(await screen.findByText("近くに候補が見つかりませんでした。")).toBeInTheDocument();
    },
  );

  it("geolocation 成功時は fallback 告知を出さず、取得座標で検索する (RH3-4b)", async () => {
    // beforeEach の mockGeolocationSuccess をそのまま使う
    render(<NearbyShrineCardListClient />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("lat=35.681236"), expect.any(Object));
    });
    expect(screen.queryByText("現在地が取れないため仮の場所（東京駅）で検索中")).not.toBeInTheDocument();
  });
});
