// Weekly Compass（PR3 Web接続）のCompassClient側契約。
//
// Weeklyは補助Presentationであり、Monthly Compassの既存挙動（uiState /
// fail-safe表示 / 推薦セクション）を一切変えない。このfileはその境界だけを固定する。
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CompassClient from "../CompassClient";

const DIRECTION_CONTEXT = {
  targetDate: "2026-09-15",
  targetYear: 2026,
  solarMonthIndex: 8,
  referenceDirections: ["北西"],
  calculationMethod: "annual_monthly_kyusei_v1",
  note: "年盤と月盤による参考情報です。日盤は使用していません。",
};

const MONTHLY_SUCCESS = {
  state: "recommendation_success",
  purpose: "career",
  direction_context: DIRECTION_CONTEXT,
  recommendation_instance_id: "abcd1234",
  recommendations: [{ shrine_id: 1, name: "北西神社", reason: "仕事運との一致" }],
};

const WEEKLY_SUCCESS = {
  state: "weekly_success",
  purpose: "career",
  week: { start: "2026-09-14", end: "2026-09-20" },
  direction_context: DIRECTION_CONTEXT,
  weekly_theme: {
    key: "career_next_step",
    title: "次の一歩を書き出す",
    message: "今週は、迷っていることを一行だけ書き出してみる。",
  },
  featured_shrines: [
    { id: 30, name_jp: "週の神社C", address: "東京都C", latitude: 35, longitude: 139, goriyaku_tags: [] },
    { id: 10, name_jp: "週の神社A", address: "東京都A", latitude: 35, longitude: 139, goriyaku_tags: [] },
  ],
  presentation_version: "weekly_presentation_v1",
};

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body };
}

/** URLごとに応答を出し分けるfetch mock。 */
function routedFetch(handlers: {
  monthly?: () => unknown;
  weekly?: () => unknown;
}) {
  return vi.fn((url: string) => {
    if (String(url).includes("/api/compass/weekly")) {
      return Promise.resolve(handlers.weekly?.() ?? jsonResponse(WEEKLY_SUCCESS));
    }
    return Promise.resolve(handlers.monthly?.() ?? jsonResponse(MONTHLY_SUCCESS));
  });
}

function fillMinimumValidInput() {
  fireEvent.click(screen.getByRole("radio", { name: "転機・仕事" }));
  fireEvent.click(screen.getByRole("button", { name: "変更する" }));
  fireEvent.click(screen.getByRole("radio", { name: "都道府県から指定" }));
  fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
  fireEvent.change(screen.getByLabelText("生年月日（方位計算に使用）"), {
    target: { value: "1990-01-01" },
  });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
  });
}

function weeklyCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/compass/weekly"));
}

describe("CompassClient Weekly Presentation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("recommendation_success の後にWeekly requestを行い、テーマと今週の神社を表示する", async () => {
    const fetchMock = routedFetch({});
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    expect(await screen.findByText("今週のテーマ")).toBeInTheDocument();
    expect(screen.getByText("次の一歩を書き出す")).toBeInTheDocument();
    expect(screen.getByText("今週は、迷っていることを一行だけ書き出してみる。")).toBeInTheDocument();
    expect(screen.getByText("今週の神社")).toBeInTheDocument();
    // Backend順序（C -> A）を維持する。
    expect(screen.getByText("週の神社C")).toBeInTheDocument();
    expect(screen.getByText("週の神社A")).toBeInTheDocument();
  });

  it("Weekly requestへ purpose / birthdate / origin を渡し、target_date と timezone は送らない", async () => {
    const fetchMock = routedFetch({});
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    await waitFor(() => expect(weeklyCalls(fetchMock)).toHaveLength(1));
    const [url, init] = weeklyCalls(fetchMock)[0];
    expect(url).toBe("/api/compass/weekly");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      purpose: "career",
      birthdate: "1990-01-01",
      origin: { lat: 35.6762, lng: 139.6503 },
    });
    expect(body).not.toHaveProperty("target_date");
    expect(body).not.toHaveProperty("timezone");
  });

  it("Monthly結果はWeekly requestの完了を待たずに表示される", async () => {
    let resolveWeekly: (value: unknown) => void = () => {};
    const weeklyPending = new Promise((resolve) => {
      resolveWeekly = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/api/compass/weekly")) return weeklyPending;
      return Promise.resolve(jsonResponse(MONTHLY_SUCCESS));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    // Weeklyがpendingのまま、Monthlyの方向と推薦が出ている。
    expect(await screen.findByText("この方向の参拝候補")).toBeInTheDocument();
    expect(screen.getByText("北西神社")).toBeInTheDocument();
    expect(screen.queryByText("今週のテーマ")).not.toBeInTheDocument();

    await act(async () => {
      resolveWeekly(jsonResponse(WEEKLY_SUCCESS));
    });

    expect(await screen.findByText("今週のテーマ")).toBeInTheDocument();
    // Monthlyの結果は消えていない。
    expect(screen.getByText("この方向の参拝候補")).toBeInTheDocument();
    expect(screen.getByText("北西神社")).toBeInTheDocument();
  });

  it("Weekly通信失敗でもMonthly結果を維持し、backend_errorにしない", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/api/compass/weekly")) return Promise.reject(new Error("network"));
      return Promise.resolve(jsonResponse(MONTHLY_SUCCESS));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    await waitFor(() => expect(weeklyCalls(fetchMock)).toHaveLength(1));
    expect(screen.getByText("この方向の参拝候補")).toBeInTheDocument();
    expect(screen.getByText("北西神社")).toBeInTheDocument();
    expect(screen.queryByText("今週のテーマ")).not.toBeInTheDocument();
    expect(screen.queryByText("只今、確認できませんでした")).not.toBeInTheDocument();
  });

  it("Weeklyが5xxを返してもMonthly結果を維持する", async () => {
    const fetchMock = routedFetch({
      weekly: () => jsonResponse({ state: "error" }, { ok: false, status: 500 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    await waitFor(() => expect(weeklyCalls(fetchMock)).toHaveLength(1));
    expect(screen.getByText("この方向の参拝候補")).toBeInTheDocument();
    expect(screen.queryByText("今週のテーマ")).not.toBeInTheDocument();
    expect(screen.queryByText("只今、確認できませんでした")).not.toBeInTheDocument();
  });

  it("Weeklyがnon-success stateを返した場合はWeeklyを表示しない", async () => {
    const fetchMock = routedFetch({
      weekly: () =>
        jsonResponse({
          state: "direction_zero_candidates",
          purpose: "career",
          week: { start: "2026-09-14", end: "2026-09-20" },
          direction_context: DIRECTION_CONTEXT,
          weekly_theme: null,
          featured_shrines: [],
          presentation_version: "weekly_presentation_v1",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    await waitFor(() => expect(weeklyCalls(fetchMock)).toHaveLength(1));
    expect(screen.queryByText("今週のテーマ")).not.toBeInTheDocument();
    expect(screen.queryByText("今週の神社")).not.toBeInTheDocument();
    expect(screen.getByText("この方向の参拝候補")).toBeInTheDocument();
  });

  it("weekly_successでもfeatured_shrinesが0件ならセクションを出さない（補充しない）", async () => {
    const fetchMock = routedFetch({
      weekly: () => jsonResponse({ ...WEEKLY_SUCCESS, featured_shrines: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    expect(await screen.findByText("今週のテーマ")).toBeInTheDocument();
    expect(screen.queryByText("今週の神社")).not.toBeInTheDocument();
  });

  it.each([
    "direction_filter_unavailable",
    "no_common_direction",
    "recommendation_eligibility_zero_candidates",
    "direction_zero_candidates",
    "evidence_zero_candidates",
    "invalid_purpose",
  ])("Monthlyが %s のときはWeekly requestを行わない", async (monthlyState) => {
    const fetchMock = routedFetch({
      monthly: () =>
        jsonResponse(
          {
            state: monthlyState,
            purpose: "career",
            direction_context: null,
            recommendation_instance_id: "abcd1234",
            recommendations: [],
          },
          { ok: monthlyState !== "invalid_purpose", status: monthlyState === "invalid_purpose" ? 400 : 200 },
        ),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    expect(weeklyCalls(fetchMock)).toHaveLength(0);
    expect(screen.queryByText("今週のテーマ")).not.toBeInTheDocument();
  });

  it("Monthlyがbackend_error（5xx）のときもWeekly requestを行わない", async () => {
    const fetchMock = routedFetch({
      monthly: () => jsonResponse({}, { ok: false, status: 500 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    expect(weeklyCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByText("只今、確認できませんでした")).toBeInTheDocument();
  });

  it("Weeklyのテーマは月の方向表示の後、月次参拝候補の前に並ぶ", async () => {
    const fetchMock = routedFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<CompassClient />);
    fillMinimumValidInput();
    await submit();

    await screen.findByText("今週のテーマ");
    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(headings).toEqual([
      "今月の参拝コンパス",
      "目的と出発地点",
      "今月、意識したい方向",
      "今週のテーマ",
      "今週の神社",
      "この方向の参拝候補",
    ]);
  });
});
