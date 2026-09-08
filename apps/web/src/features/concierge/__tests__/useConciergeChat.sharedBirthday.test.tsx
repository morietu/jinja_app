import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  postConciergeChat: vi.fn(),
  persistBirthday: vi.fn(),
  trackRecommendationQuality: vi.fn(),
}));

vi.mock("@/lib/api/concierge", () => ({
  fetchThreads: vi.fn(),
  fetchThreadDetail: vi.fn(),
  postConciergeChat: mocks.postConciergeChat,
}));

vi.mock("@/lib/api/concierge/normalize", () => ({
  normalizeRecommendations: (value: unknown) => (Array.isArray(value) ? value : []),
}));

vi.mock("@/lib/analytics/searchEvents", () => ({
  trackRecommendationQuality: mocks.trackRecommendationQuality,
}));

vi.mock("@/lib/profile/useSharedBirthdayPersistence", () => ({
  useSharedBirthdayPersistence: () => ({
    savedBirthday: null,
    isLoggedIn: true,
    persistBirthday: mocks.persistBirthday,
  }),
}));

import { useConciergeChat } from "@/features/concierge/hooks";

function successPayload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    plan: "free",
    remaining: 2,
    limit: 3,
    limitReached: false,
    thread: { id: 10, title: "相談" },
    data: { recommendations: [] },
    ...overrides,
  };
}

describe("useConciergeChat Shared Birthday Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("成功したConcierge requestで実際に使用したtop-level birthdayを保存境界へ渡す", async () => {
    mocks.postConciergeChat.mockResolvedValue(successPayload());
    const { result } = renderHook(() => useConciergeChat(null));

    await act(async () => {
      await result.current.send({
        version: 1,
        query: "仕事について整理したいです",
        birthdate: "1990-01-01",
      } as any);
    });

    expect(mocks.postConciergeChat).toHaveBeenCalledTimes(1);
    expect(mocks.persistBirthday).toHaveBeenCalledTimes(1);
    expect(mocks.persistBirthday).toHaveBeenCalledWith("1990-01-01");
  });

  it("baseFiltersのbirthday fallbackも実送信値として保存境界へ渡す", async () => {
    mocks.postConciergeChat.mockResolvedValue(successPayload());
    const { result } = renderHook(() =>
      useConciergeChat(null, { filters: { birthdate: "1984-05-15" } }),
    );

    await act(async () => {
      await result.current.send({
        version: 1,
        query: "これからの流れを整理したいです",
      } as any);
    });

    const sentRequest = mocks.postConciergeChat.mock.calls[0][0];
    expect(sentRequest.birthdate).toBe("1984-05-15");
    expect(mocks.persistBirthday).toHaveBeenCalledWith("1984-05-15");
  });

  it("Backendがok=falseを返した場合はbirthdayを保存しない", async () => {
    mocks.postConciergeChat.mockResolvedValue(successPayload({ ok: false }));
    const { result } = renderHook(() => useConciergeChat(null));

    await act(async () => {
      await result.current.send({
        version: 1,
        query: "仕事について整理したいです",
        birthdate: "1990-01-01",
      } as any);
    });

    expect(mocks.persistBirthday).not.toHaveBeenCalled();
  });

  it("Concierge通信失敗時はbirthdayを保存しない", async () => {
    mocks.postConciergeChat.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useConciergeChat(null));

    await act(async () => {
      await result.current.send({
        version: 1,
        query: "仕事について整理したいです",
        birthdate: "1990-01-01",
      } as any);
    });

    expect(mocks.persistBirthday).not.toHaveBeenCalled();
  });
});
