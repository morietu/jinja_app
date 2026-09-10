import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import CompassClient from "../CompassClient";

type GetCurrentPosition = typeof navigator.geolocation.getCurrentPosition;

function stubGeolocation(impl: GetCurrentPosition) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: impl },
  });
}

function geoSuccess(lat: number, lng: number): GetCurrentPosition {
  return ((success) =>
    success({
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy: 40,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition)) as GetCurrentPosition;
}

function geoError(code: number): GetCurrentPosition {
  return ((_success, error) => error?.({ code, message: "x" } as GeolocationPositionError)) as GetCurrentPosition;
}

async function openDeviceOrigin() {
  fireEvent.click(screen.getByRole("button", { name: "変更する" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("radio", { name: "現在地を使用" }));
  });
}

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

describe("CompassClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("初期状態では月見出しとProduct Promiseのみを表示し、結果セクションは出さない", () => {
    render(<CompassClient />);
    expect(screen.getByRole("heading", { level: 1, name: "今月の参拝コンパス" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "今月の参拝コンパス" })).toBeInTheDocument();
    expect(screen.getByText("今月の流れと目的から、向かう方向と参拝候補を見つけます。")).toBeInTheDocument();
    expect(screen.queryByText("この方向の参拝候補")).not.toBeInTheDocument();
  });

  it("native date inputを使わず、年・月・日の数値入力を表示する", () => {
    render(<CompassClient />);

    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText("生年月日の年")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("生年月日の年")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText("生年月日の年")).toHaveAttribute("placeholder", "YYYY");
    expect(screen.getByLabelText("生年月日の月")).toHaveAttribute("placeholder", "MM");
    expect(screen.getByLabelText("生年月日の日")).toHaveAttribute("placeholder", "DD");
  });

  it("年4桁、月2桁の入力完了で次のフィールドへfocusし、Backspaceで前へ戻る", () => {
    render(<CompassClient />);
    const year = screen.getByLabelText("生年月日の年");
    const month = screen.getByLabelText("生年月日の月");
    const day = screen.getByLabelText("生年月日の日");

    fireEvent.change(year, { target: { value: "1984" } });
    expect(document.activeElement).toBe(month);
    fireEvent.change(month, { target: { value: "05" } });
    expect(document.activeElement).toBe(day);
    fireEvent.keyDown(day, { key: "Backspace" });
    expect(document.activeElement).toBe(month);
    fireEvent.change(month, { target: { value: "" } });
    fireEvent.keyDown(month, { key: "Backspace" });
    expect(document.activeElement).toBe(year);
  });

  it("数字以外を入力値として採用しない", () => {
    render(<CompassClient />);

    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "19a9" } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "0x5" } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "1z5" } });

    expect(screen.getByLabelText("生年月日の年")).toHaveValue("199");
    expect(screen.getByLabelText("生年月日の月")).toHaveValue("05");
    expect(screen.getByLabelText("生年月日の日")).toHaveValue("15");
  });

  it.each([["2024", "02", "29"]])("leap yearの%jは送信できる", async (year, month, day) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: "no_common_direction",
        purpose: "career",
        direction_context: null,
        recommendations: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CompassClient />);
    fireEvent.click(screen.getByRole("radio", { name: "転機・仕事" }));
    setOriginViaPrefecture();
    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: year } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: month } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: day } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).birthdate).toBe("2024-02-29");
  });

  it("存在しない日付は不正日付として送信しない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CompassClient />);
    fireEvent.click(screen.getByRole("radio", { name: "転機・仕事" }));
    setOriginViaPrefecture();
    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "02" } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));

    expect(screen.getByText("正しい生年月日を入力してください。")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("目的・出発地点・生年月日が未入力のまま送信すると、それぞれ個別のエラーを出しAPIを呼ばない", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<CompassClient />);

    fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));

    expect(screen.getByText("出発地点を選択してください。")).toBeInTheDocument();
    expect(screen.getByText("生年月日を入力してください。")).toBeInTheDocument();
    expect(screen.getByText("目的を選択してください。")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("入力が揃うとAPIへpurpose/origin/birthdateを送信し、成功時に方向と推薦を表示する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
          note: "年盤と月盤による参考情報です。日盤は使用していません。",
        },
        recommendations: [{ shrine_id: 1, name: "北西神社", reason: "仕事運との一致" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    expect(sentBody.purpose).toBe("career");
    expect(sentBody.birthdate).toBe("1990-01-01");
    expect(sentBody.origin).toEqual({ lat: 35.6762, lng: 139.6503 });

    expect(await screen.findByText("今月意識したい方向: 北西")).toBeInTheDocument();
    expect(screen.getByText("この方向の参拝候補")).toBeInTheDocument();
    expect(screen.getByText("北西神社")).toBeInTheDocument();
    // The no_common_direction continuation CTA is specific to that state
    // and must not appear on a successful result.
    expect(screen.queryByRole("link", { name: "コンシェルジュで相談する" })).not.toBeInTheDocument();
  });

  it("calculationMethodがannual_monthly_kyusei_v1のとき、共通方位の説明文を表示する（fallback文言は出さない）", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
          note: "年盤と月盤による参考情報です。日盤は使用していません。",
        },
        recommendations: [{ shrine_id: 1, name: "北西神社", reason: "仕事運との一致" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(
      await screen.findByText("年盤と月盤の両方で重なる、今月の参考方位です。日盤は使用していません。（参考情報です）"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "年盤と月盤で重なる方位がないため、今月の月盤を参考にした方位です。日盤は使用していません。（参考情報です）",
      ),
    ).not.toBeInTheDocument();
    // P1 UX fix (docs/audit/compass-result-experience.md Section 26-1):
    // at-a-glance visual distinction, not just the explanatory note.
    expect(screen.getByText("年盤・月盤 共通")).toBeInTheDocument();
    expect(screen.queryByText("今月の月盤を参考")).not.toBeInTheDocument();
  });

  it("calculationMethodがmonthly_kyusei_v1のとき、月盤fallbackの説明文を表示し、共通方位であるかのような文言は出さない", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
          note: "年盤と月盤による参考情報です。日盤は使用していません。",
        },
        recommendations: [{ shrine_id: 2, name: "南東神社", reason: "仕事運との一致" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(
      await screen.findByText(
        "年盤と月盤で重なる方位がないため、今月の月盤を参考にした方位です。日盤は使用していません。（参考情報です）",
      ),
    ).toBeInTheDocument();
    // Must never claim annual/monthly agreement for a monthly-only result
    // (Product Contract Section 2.2-7, audit Section 9: SEMANTICALLY MISLEADING).
    expect(
      screen.queryByText("年盤と月盤の両方で重なる、今月の参考方位です。日盤は使用していません。（参考情報です）"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("年盤と月盤による参考情報です。日盤は使用していません。（参考情報です）"),
    ).not.toBeInTheDocument();
    // Direction visual and recommendation flow must remain unaffected.
    expect(screen.getByText("今月意識したい方向: 南東")).toBeInTheDocument();
    expect(screen.getByText("南東神社")).toBeInTheDocument();
    // P1 UX fix (docs/audit/compass-result-experience.md Section 26-1):
    // at-a-glance visual distinction, not error/warning framed, not the
    // COMMON label.
    expect(screen.getByText("今月の月盤を参考")).toBeInTheDocument();
    expect(screen.queryByText("年盤・月盤 共通")).not.toBeInTheDocument();
  });

  it("calculationMethodが未知の値のとき、COMMON/FALLBACKいずれのラベルも捏造せず表示を安定させる", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
          // Intentionally not one of the two known contract values --
          // simulates a future/unexpected calculationMethod reaching the
          // frontend unchanged.
          calculationMethod: "unknown_future_method_v1" as never,
          note: "note",
        },
        recommendations: [{ shrine_id: 3, name: "北西神社", reason: "仕事運との一致" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    // The direction visual and recommendations still render (component
    // does not crash or hide unrelated content because of an unrecognized
    // calculationMethod).
    expect(await screen.findByText("今月意識したい方向: 北西")).toBeInTheDocument();
    expect(screen.getByText("北西神社")).toBeInTheDocument();
    // Neither label is fabricated for an unrecognized value.
    expect(screen.queryByText("年盤・月盤 共通")).not.toBeInTheDocument();
    expect(screen.queryByText("今月の月盤を参考")).not.toBeInTheDocument();
  });

  it("「その他の目的」から選んでも送信payloadは折りたたみ表示に影響されず正しいslugになる（Purpose UI Polish回帰確認）", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: "recommendation_success",
        purpose: "travel_safe",
        direction_context: {
          targetDate: "2026-09-15",
          targetYear: 2026,
          solarMonthIndex: 8,
          referenceDirections: ["北西"],
          calculationMethod: "annual_monthly_kyusei_v1",
          note: "note",
        },
        recommendations: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fireEvent.click(screen.getByRole("button", { name: /その他の目的を見る/ }));
    fireEvent.click(screen.getByRole("radio", { name: "移動・安全" }));
    setOriginViaPrefecture();
    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "1990" } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "01" } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "01" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).purpose).toBe("travel_safe");
  });

  it("direction_zero_candidatesとdirection_filter_unavailableを区別して表示する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: "direction_zero_candidates",
        purpose: "career",
        direction_context: {
          targetDate: "2026-09-15",
          targetYear: 2026,
          solarMonthIndex: 8,
          referenceDirections: ["北西"],
          calculationMethod: "annual_monthly_kyusei_v1",
          note: "note",
        },
        recommendations: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(await screen.findByText("この方向の参拝候補が見つかりませんでした")).toBeInTheDocument();
    expect(screen.queryByText("方向の参考情報を計算できませんでした")).not.toBeInTheDocument();
    expect(screen.queryByText("この方向の参拝候補")).not.toBeInTheDocument();
  });

  it("no_common_directionは正当な結果として表示し、direction_filter_unavailableの誤解を招く案内文は出さない", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: "no_common_direction",
        purpose: "career",
        direction_context: null,
        recommendations: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(await screen.findByText("今月は方位の参考情報がありません")).toBeInTheDocument();
    // Narrowed residual semantics (#2508 Option C): must communicate that
    // BOTH the common (annual∩monthly) direction and the monthly-only
    // fallback were checked and came up empty -- not just the old,
    // pre-fallback "annual and monthly didn't agree" framing.
    expect(
      screen.getByText(
        "生年月日・出発地点はどちらも問題ありません。年盤と月盤の共通方位も、今月の月盤単独の参考方位も、今月はいずれもありませんでした。",
      ),
    ).toBeInTheDocument();
    // Must not imply the failure is a calculation error or an input mistake.
    expect(
      screen.queryByText("生年月日または出発地点をご確認のうえ、もう一度お試しください。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("方向の参考情報を計算できませんでした")).not.toBeInTheDocument();
    // No direction visual, no recommendation cards -- there is nothing to show.
    expect(screen.queryByText("今月意識したい方向:", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("この方向の参拝候補")).not.toBeInTheDocument();

    // P2 UX fix (docs/audit/compass-result-experience.md Section 26-2):
    // a legitimate no-direction result must not be a dead end -- exactly
    // one clear continuation, pointing to the existing /concierge route.
    const continueLink = screen.getByRole("link", { name: "コンシェルジュで相談する" });
    expect(continueLink).toBeInTheDocument();
    expect(continueLink).toHaveAttribute("href", "/concierge");
    // Retrying identical inputs must never be offered as the (or a) primary CTA.
    expect(screen.queryByRole("button", { name: /もう一度/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /もう一度/ })).not.toBeInTheDocument();
  });

  it("direction_filter_unavailableは引き続き既存のfail-safe文言を表示する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: "direction_filter_unavailable",
        purpose: "career",
        direction_context: null,
        recommendations: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(await screen.findByText("方向の参考情報を計算できませんでした")).toBeInTheDocument();
    expect(screen.getByText("生年月日または出発地点をご確認のうえ、もう一度お試しください。")).toBeInTheDocument();
    expect(screen.queryByText("今月は方位の参考情報がありません")).not.toBeInTheDocument();
    // direction_filter_unavailable is a distinct Group A error state --
    // the no_common_direction continuation CTA must not leak into it
    // (docs/audit/compass-result-experience.md Section 26-2, Section 11
    // "error-state separation").
    expect(screen.queryByRole("link", { name: "コンシェルジュで相談する" })).not.toBeInTheDocument();
  });

  it("バックエンドエラー時は落ち着いた文言のエラー状態を表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<CompassClient />);
    fillMinimumValidInput();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(await screen.findByText("只今、確認できませんでした")).toBeInTheDocument();
  });

  it("送信中はボタンが無効化され、ラベルが変わる", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );

    render(<CompassClient />);
    fillMinimumValidInput();
    fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));

    expect(await screen.findByRole("button", { name: "確認しています…" })).toBeDisabled();

    await act(async () => {
      resolveFetch({
        ok: true,
        status: 200,
        json: async () => ({
          state: "direction_zero_candidates",
          purpose: "career",
          direction_context: null,
          recommendations: [],
        }),
      });
    });
  });

  describe("出発地点「現在地を使用」(RH3-4b)", () => {
    it("geolocation 成功時は現在地を出発地点に設定し、deviceError を出さない", async () => {
      stubGeolocation(geoSuccess(35.5, 139.5));
      render(<CompassClient />);

      await openDeviceOrigin();

      await waitFor(() => {
        expect(screen.getAllByText("現在の出発地点は現在地、確定した位置です。").length).toBeGreaterThan(0);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("PERMISSION_DENIED (code 1) は許可を促す文言 + 駅名・住所 fallback を表示し、crash しない", async () => {
      stubGeolocation(geoError(1));
      render(<CompassClient />);

      await openDeviceOrigin();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("現在地を取得できませんでした。位置情報の許可を確認してください。");
      expect(screen.getByRole("radio", { name: "駅名・住所から指定" })).toBeEnabled();
      // 出発地点は未設定のまま（fallback へ誘導）
      expect(screen.getAllByText("出発地点は設定されていません。").length).toBeGreaterThan(0);
    });

    it("TIMEOUT (code 3) は汎用の取得失敗文言を表示する", async () => {
      stubGeolocation(geoError(3));
      render(<CompassClient />);

      await openDeviceOrigin();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("現在地を取得できませんでした。");
    });

    it("POSITION_UNAVAILABLE (code 2) も汎用の取得失敗文言を表示する", async () => {
      stubGeolocation(geoError(2));
      render(<CompassClient />);

      await openDeviceOrigin();

      expect((await screen.findByRole("alert")).textContent).toBe("現在地を取得できませんでした。");
    });

    it("失敗表示は重複CTAを内包せず、既存の「駅名・住所から指定」へそのまま移れる", async () => {
      stubGeolocation(geoError(2));
      render(<CompassClient />);

      await openDeviceOrigin();

      const alert = await screen.findByRole("alert");
      // 代替導線はラジオ側に一本化する（エラー領域内にCTAを持たない）
      expect(within(alert).queryByRole("button")).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("radio", { name: "駅名・住所から指定" }));
      });

      expect(screen.getByRole("combobox", { name: "駅名または住所" })).toBeEnabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("retry: 1回目失敗 → 2回目成功で現在地が設定され、古いエラーが success を上書きしない", async () => {
      let call = 0;
      stubGeolocation(((success, error) => {
        call += 1;
        if (call === 1) error?.({ code: 3, message: "timeout" } as GeolocationPositionError);
        else geoSuccess(35.6, 139.6)(success, error, undefined as unknown as PositionOptions);
      }) as GetCurrentPosition);

      render(<CompassClient />);

      await openDeviceOrigin();
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      // 別モードへ切り替えてから再度「現在地を使用」= retry
      await act(async () => {
        fireEvent.click(screen.getByRole("radio", { name: "駅名・住所から指定" }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("radio", { name: "現在地を使用" }));
      });

      await waitFor(() => {
        expect(screen.getAllByText("現在の出発地点は現在地、確定した位置です。").length).toBeGreaterThan(0);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
