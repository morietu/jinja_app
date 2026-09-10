import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Compass lifecycle analytics (PR-A,
// docs/audit/compass-analytics-contract-readiness.md §6-10): Home discovery
// -> Compass entry -> Compass activation/result. Recommendation exposure,
// Shrine Detail, Favorite/Visit/Reflection attribution are explicitly out
// of scope for this PR and are not touched here.
//
// Mocked at the dispatch-helper boundary (trackSearchEvent), not PostHog
// itself -- matches ConciergeSectionsRenderer.recommendationInstanceId.test.tsx.
const analyticsMocks = vi.hoisted(() => ({
  trackSearchEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/searchEvents", () => ({
  trackSearchEvent: analyticsMocks.trackSearchEvent,
}));

// Local override of vitest.setup.ts's blanket `useSearchParams: () => new
// URLSearchParams()` -- reads window.location.search dynamically so each
// test can set `?ref=home` via history.pushState, same pattern as
// src/app/shrines/__tests__/page.test.tsx.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import CompassClient from "../CompassClient";

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

describe("CompassClient lifecycle analytics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    analyticsMocks.trackSearchEvent.mockClear();
    window.history.pushState({}, "", "/compass");
  });

  describe("Compass Entry", () => {
    it("直接遷移ではcompass_entryをreferrer_source=directで一度だけ送る", () => {
      render(<CompassClient />);

      const entryCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_entry");
      expect(entryCalls).toHaveLength(1);
      expect(entryCalls[0][1]).toEqual({ referrer_source: "direct" });
    });

    it("?ref=homeで遷移した場合はcompass_entryをreferrer_source=homeで送る（HomeのCTAクリックとは別イベント）", () => {
      window.history.pushState({}, "", "/compass?ref=home");
      render(<CompassClient />);

      const entryCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_entry");
      expect(entryCalls).toHaveLength(1);
      expect(entryCalls[0][1]).toEqual({ referrer_source: "home" });
    });

    it("再レンダーではcompass_entryを重複送信しない", () => {
      const { rerender } = render(<CompassClient />);
      fireEvent.click(screen.getByRole("radio", { name: "転機・仕事" }));
      rerender(<CompassClient />);

      const entryCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_entry");
      expect(entryCalls).toHaveLength(1);
    });
  });

  describe("Compass Activation / Result", () => {
    it("必須項目が未入力のまま送信するとcompass_resultを送らない（バリデーション失敗はActivationとして扱わない）", () => {
      vi.stubGlobal("fetch", vi.fn());
      render(<CompassClient />);

      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));

      expect(analyticsMocks.trackSearchEvent).not.toHaveBeenCalledWith("compass_result", expect.anything());
      expect(fetch).not.toHaveBeenCalled();
    });

    it("recommendation_successでresult_state・recommendation_count・purpose・origin_modeを送り、PIIを含まない", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            state: "recommendation_success",
            purpose: "career",
            direction_context: {
              targetDate: "2026-09-15",
              targetYear: 2026,
              solarMonthIndex: 8,
              referenceDirections: ["北西"],
              calculationMethod: "annual_monthly_kyusei_v1",
              note: "note",
            },
            recommendation_instance_id: "compass01",
            recommendations: [
              { shrine_id: 1, name: "北西神社", reason: "仕事運との一致" },
              { shrine_id: 2, name: "北西二の宮", reason: "縁結び" },
            ],
            // Compass Geographic Distance Boundary metadata -- backend
            // orchestrator is the source of truth, mirrored verbatim.
            distance_stage_km: 15,
            direction_candidate_count: 6,
            distance_candidate_count: 2,
          }),
        }),
      );

      render(<CompassClient />);
      fillMinimumValidInput();
      await submit();

      const resultCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_result");
      expect(resultCalls).toHaveLength(1);
      const [, payload] = resultCalls[0];

      expect(payload).toEqual({
        result_state: "recommendation_success",
        purpose: "career",
        origin_mode: "prefecture",
        has_birthdate: true,
        recommendation_count: 2,
        recommendationInstanceId: "compass01",
        calculationMethod: "annual_monthly_kyusei_v1",
        distance_stage_km: 15,
        direction_candidate_count: 6,
        distance_candidate_count: 2,
      });

      // PII / data-minimization contract (task §10, §24 of the readiness audit):
      const serialized = JSON.stringify(payload);
      expect(payload).not.toHaveProperty("birthdate");
      expect(payload).not.toHaveProperty("latitude");
      expect(payload).not.toHaveProperty("longitude");
      expect(serialized).not.toContain("1990-01-01");
      expect(serialized).not.toMatch(/東京都/);
      expect(serialized).not.toContain("35.6762");
      expect(serialized).not.toContain("139.6503");
    });

    it("calculationMethodがmonthly_kyusei_v1（Monthly Fallback）のとき、compass_resultにそのままの値を送る（新規eventは作らない）", async () => {
      // docs/audit/compass-monthly-fallback-ui-analytics-boundary.md Section 13
      // Classification B: 既存compass_resultへの同一event拡張で足り、専用の
      // fallback eventは不要と判定済み。
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            state: "recommendation_success",
            purpose: "career",
            direction_context: {
              targetDate: "2026-08-20",
              targetYear: 2026,
              solarMonthIndex: 7,
              referenceDirections: ["南東"],
              calculationMethod: "monthly_kyusei_v1",
              note: "note",
            },
            recommendation_instance_id: "compass02",
            recommendations: [{ shrine_id: 3, name: "南東神社", reason: "仕事運との一致" }],
            // Monthly Fallback uses the identical Distance Boundary contract
            // as COMMON -- same metadata shape, no separate rule.
            distance_stage_km: 60,
            direction_candidate_count: 1,
            distance_candidate_count: 1,
          }),
        }),
      );

      render(<CompassClient />);
      fillMinimumValidInput();
      await submit();

      const resultCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_result");
      expect(resultCalls).toHaveLength(1);
      const [, payload] = resultCalls[0];

      expect(payload).toEqual({
        result_state: "recommendation_success",
        purpose: "career",
        origin_mode: "prefecture",
        has_birthdate: true,
        recommendation_count: 1,
        recommendationInstanceId: "compass02",
        calculationMethod: "monthly_kyusei_v1",
        distance_stage_km: 60,
        direction_candidate_count: 1,
        distance_candidate_count: 1,
      });

      // No new event name is ever used for the fallback case.
      const eventNames = analyticsMocks.trackSearchEvent.mock.calls.map(([name]) => name);
      expect(eventNames).not.toContain("compass_monthly_fallback");
      expect(eventNames.every((name) => name === "compass_entry" || name === "compass_result")).toBe(true);
    });

    it("direction_zero_candidatesとdirection_filter_unavailableをresult_stateとして区別する（collapse禁止）", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      render(<CompassClient />);
      fillMinimumValidInput();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          state: "direction_zero_candidates",
          purpose: "career",
          direction_context: null,
          recommendations: [],
          // Direction Filter found candidates, but none survived the
          // Distance Stage's 60km outer ring (§ Fail-safe "Direction候補は
          // あるが60km以内0件"): stage=60, direction count > 0, distance
          // count = 0. Not fabricated -- mirrors what the backend would send.
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
          state: "direction_filter_unavailable",
          purpose: "career",
          direction_context: null,
          recommendations: [],
        }),
      });
      await submit();

      const resultStates = analyticsMocks.trackSearchEvent.mock.calls
        .filter(([name]) => name === "compass_result")
        .map(([, payload]) => (payload as { result_state: string }).result_state);

      expect(resultStates).toEqual(["direction_zero_candidates", "direction_filter_unavailable"]);
      // recommendation_count must not be fabricated for non-success states.
      const zeroCandidatesPayload = analyticsMocks.trackSearchEvent.mock.calls.find(
        ([name, payload]) =>
          name === "compass_result" &&
          (payload as { result_state: string }).result_state === "direction_zero_candidates",
      )?.[1] as {
        recommendation_count: unknown;
        calculationMethod: unknown;
        distance_stage_km: unknown;
        direction_candidate_count: unknown;
        distance_candidate_count: unknown;
      };
      expect(zeroCandidatesPayload.recommendation_count).toBeNull();
      // Distance Boundary metadata forwards verbatim even for a zero-candidate result.
      expect(zeroCandidatesPayload.distance_stage_km).toBe(60);
      expect(zeroCandidatesPayload.direction_candidate_count).toBe(3);
      expect(zeroCandidatesPayload.distance_candidate_count).toBe(0);

      // direction_filter_unavailable never reaches the distance stage --
      // metadata must stay null, never fabricated from the previous request.
      const unavailableDistancePayload = analyticsMocks.trackSearchEvent.mock.calls.find(
        ([name, payload]) =>
          name === "compass_result" &&
          (payload as { result_state: string }).result_state === "direction_filter_unavailable",
      )?.[1] as { distance_stage_km: unknown; direction_candidate_count: unknown; distance_candidate_count: unknown };
      expect(unavailableDistancePayload.distance_stage_km).toBeNull();
      expect(unavailableDistancePayload.direction_candidate_count).toBeNull();
      expect(unavailableDistancePayload.distance_candidate_count).toBeNull();
      // direction_context is null for both fixtures above -- calculationMethod
      // must not be fabricated (task §12: direction_filter_unavailable stays
      // ERROR, never gets a fake monthly_kyusei_v1 just because Fallback exists).
      expect(zeroCandidatesPayload.calculationMethod).toBeNull();
      const unavailablePayload = analyticsMocks.trackSearchEvent.mock.calls.find(
        ([name, payload]) =>
          name === "compass_result" &&
          (payload as { result_state: string }).result_state === "direction_filter_unavailable",
      )?.[1] as { calculationMethod: unknown };
      expect(unavailablePayload.calculationMethod).toBeNull();
    });

    it("no_common_directionとdirection_filter_unavailableをresult_stateとして区別する（collapse禁止）", async () => {
      // Runtime Contract Section 8 Group A (direction_filter_unavailable)
      // vs Group B (no_common_direction, a VALID result) -- the generic
      // trackCompassResult() pipeline forwards whatever backend state
      // string it receives without transformation, so this is a
      // type-contract/regression check, not new instrumentation logic.
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      render(<CompassClient />);
      fillMinimumValidInput();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          state: "no_common_direction",
          purpose: "career",
          direction_context: null,
          recommendations: [],
        }),
      });
      await submit();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          state: "direction_filter_unavailable",
          purpose: "career",
          direction_context: null,
          recommendations: [],
        }),
      });
      await submit();

      const resultStates = analyticsMocks.trackSearchEvent.mock.calls
        .filter(([name]) => name === "compass_result")
        .map(([, payload]) => (payload as { result_state: string }).result_state);

      expect(resultStates).toEqual(["no_common_direction", "direction_filter_unavailable"]);

      // Neither state carries a direction_context, so calculationMethod must
      // not be fabricated for either (task §11: no_common_direction stays
      // VALID_NO_DIRECTION, never gets a fake calculationMethod value).
      const payloads = analyticsMocks.trackSearchEvent.mock.calls
        .filter(([name]) => name === "compass_result")
        .map(([, payload]) => payload as { calculationMethod: unknown });
      expect(payloads[0].calculationMethod).toBeNull();
      expect(payloads[1].calculationMethod).toBeNull();
    });

    it("invalid_purpose（HTTP 400）をresult_stateとして正しく表す", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({
            state: "invalid_purpose",
            purpose: null,
            direction_context: null,
            recommendations: [],
          }),
        }),
      );

      render(<CompassClient />);
      fillMinimumValidInput();
      await submit();

      const resultCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_result");
      expect(resultCalls).toHaveLength(1);
      expect(resultCalls[0][1]).toMatchObject({ result_state: "invalid_purpose" });
    });

    it("バックエンドエラー(HTTP 500)をresult_state=backend_errorとして表す", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      render(<CompassClient />);
      fillMinimumValidInput();
      await submit();

      const resultCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_result");
      expect(resultCalls).toHaveLength(1);
      expect(resultCalls[0][1]).toMatchObject({
        result_state: "backend_error",
        recommendation_count: null,
        calculationMethod: null,
      });
    });

    it("ネットワーク例外もresult_state=backend_errorとして表す", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

      render(<CompassClient />);
      fillMinimumValidInput();
      await submit();

      const resultCalls = analyticsMocks.trackSearchEvent.mock.calls.filter(([name]) => name === "compass_result");
      expect(resultCalls).toHaveLength(1);
      expect(resultCalls[0][1]).toMatchObject({ result_state: "backend_error", calculationMethod: null });
    });
  });

  describe("匿名利用", () => {
    it("未ログイン状態でもcompass_entry/compass_resultの計測が例外を投げない", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            state: "recommendation_success",
            purpose: "career",
            direction_context: null,
            recommendations: [],
          }),
        }),
      );

      expect(() => render(<CompassClient />)).not.toThrow();
      fillMinimumValidInput();
      await expect(submit()).resolves.not.toThrow();
    });
  });
});
