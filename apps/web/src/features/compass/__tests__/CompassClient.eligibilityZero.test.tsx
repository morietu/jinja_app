import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared Recommendation Eligibility gate が候補を全て除外した状態
// (`recommendation_eligibility_zero_candidates`,
// docs/knowledge/recommendation-eligibility-contract.md) を、frontend が
// backend error / direction failure / direction_zero_candidates /
// evidence_zero_candidates のいずれとも取り違えないことを固定する。
const analyticsMocks = vi.hoisted(() => ({
  trackSearchEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/searchEvents", () => ({
  trackSearchEvent: analyticsMocks.trackSearchEvent,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import CompassClient from "../CompassClient";
import type { CompassRecommendationsResponse, CompassUiState } from "../types";

function setOriginViaPrefecture() {
  fireEvent.click(screen.getByRole("button", { name: "変更する" }));
  fireEvent.click(screen.getByRole("radio", { name: "都道府県から指定" }));
  fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
}

function fillMinimumValidInput() {
  fireEvent.click(screen.getByRole("radio", { name: "転機・仕事" }));
  setOriginViaPrefecture();
  fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "1990" } });
  fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "01" } });
  fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "01" } });
}

function submit() {
  return act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
  });
}

const ELIGIBILITY_ZERO_BODY = {
  state: "recommendation_eligibility_zero_candidates",
  purpose: "career",
  direction_context: {
    targetDate: "2026-09-15",
    targetYear: 2026,
    solarMonthIndex: 8,
    referenceDirections: ["北西"],
    calculationMethod: "annual_monthly_kyusei_v1",
    note: "note",
  },
  recommendation_instance_id: "compass-elig-zero",
  recommendations: [],
  // 候補生成はDirection Filter/Distance Stageへ到達していないためnull。
  distance_stage_km: null,
  direction_candidate_count: null,
  distance_candidate_count: null,
} as const;

describe("Compass recommendation_eligibility_zero_candidates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    analyticsMocks.trackSearchEvent.mockClear();
    window.history.pushState({}, "", "/compass");
  });

  // 8: frontend/API state unions accept the new state
  it("API response型とUI state型が新stateを受け付ける", () => {
    const response: CompassRecommendationsResponse["state"] = "recommendation_eligibility_zero_candidates";
    const ui: CompassUiState = "recommendation_eligibility_zero_candidates";
    expect(response).toBe("recommendation_eligibility_zero_candidates");
    expect(ui).toBe("recommendation_eligibility_zero_candidates");
  });

  it("backend error / direction failure として扱わない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ELIGIBILITY_ZERO_BODY,
      }),
    );
    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    expect(screen.getByText("ご案内できる参拝候補がまだありません")).toBeTruthy();
    // 4: 「該当する神社が1件も登録されていない」と断定せず、現在の条件に
    // 限定した表現であること。
    expect(screen.getByText("現在の条件では、ご案内に必要な情報を確認できる神社が見つかりませんでした。")).toBeTruthy();
    expect(screen.queryByText(/登録されていません/)).toBeNull();
    // 既存の /concierge CTA と空結果UI構造は維持する。
    expect(screen.getByRole("link", { name: "コンシェルジュで相談する" })).toBeTruthy();
    expect(screen.queryByText("只今、確認できませんでした")).toBeNull();
    expect(screen.queryByText("方向の参考情報を計算できませんでした")).toBeNull();
    expect(screen.queryByText("この方向の参拝候補が見つかりませんでした")).toBeNull();
    expect(screen.queryByText("参拝候補の情報を確認できませんでした")).toBeNull();
  });

  // 9: analytics preserves the new state distinctly
  it("compass_resultのresult_stateとして他のzero stateへ統合されない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CompassClient />);
    fillMinimumValidInput();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ELIGIBILITY_ZERO_BODY,
    });
    await submit();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        state: "direction_zero_candidates",
        purpose: "career",
        direction_context: null,
        recommendations: [],
        distance_stage_km: 60,
        direction_candidate_count: 3,
        distance_candidate_count: 0,
      }),
    });
    await submit();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        state: "evidence_zero_candidates",
        purpose: "career",
        direction_context: null,
        recommendations: [],
        distance_stage_km: 60,
        direction_candidate_count: 3,
        distance_candidate_count: 3,
      }),
    });
    await submit();

    const resultStates = analyticsMocks.trackSearchEvent.mock.calls
      .filter(([name]) => name === "compass_result")
      .map(([, payload]) => (payload as { result_state: string }).result_state);

    expect(resultStates).toEqual([
      "recommendation_eligibility_zero_candidates",
      "direction_zero_candidates",
      "evidence_zero_candidates",
    ]);

    const eligibilityPayload = analyticsMocks.trackSearchEvent.mock.calls.find(
      ([name, payload]) =>
        name === "compass_result" &&
        (payload as { result_state: string }).result_state === "recommendation_eligibility_zero_candidates",
    )?.[1] as {
      recommendation_count: unknown;
      direction_candidate_count: unknown;
      distance_candidate_count: unknown;
    };
    // 非successではrecommendation_countをでっち上げない。Direction/Distance
    // stageへ到達していないためcountもnullのまま。
    expect(eligibilityPayload.recommendation_count).toBeNull();
    expect(eligibilityPayload.direction_candidate_count).toBeNull();
    expect(eligibilityPayload.distance_candidate_count).toBeNull();
  });
});
