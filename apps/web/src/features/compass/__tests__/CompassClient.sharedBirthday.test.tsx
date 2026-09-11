import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CompassClient from "../CompassClient";

function setOriginViaPrefecture() {
  fireEvent.click(screen.getByRole("button", { name: "変更する" }));
  fireEvent.click(screen.getByRole("radio", { name: "都道府県から指定" }));
  fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
}

function fillPurposeAndOrigin() {
  fireEvent.click(screen.getByRole("radio", { name: "転機・仕事" }));
  setOriginViaPrefecture();
}

function successResponse() {
  return {
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
      recommendations: [{ shrine_id: 1, name: "北西神社", reason: "仕事運との一致" }],
    }),
  };
}

describe("CompassClient Shared Birthday Context", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("保存済みbirthdayがある場合は入力欄の初期値として再利用する", () => {
    render(<CompassClient savedBirthday="1984-05-15" isLoggedIn />);

    expect(screen.getByLabelText("生年月日の年")).toHaveValue("1984");
    expect(screen.getByLabelText("生年月日の月")).toHaveValue("05");
    expect(screen.getByLabelText("生年月日の日")).toHaveValue("15");
    expect(screen.getByText("ログイン中は次回以降も利用できるよう保存されます。")).toBeInTheDocument();
  });

  it("Auth hydrationで保存birthdayが後から届いた場合、未編集ならprefillする", async () => {
    const { rerender } = render(<CompassClient savedBirthday={null} isLoggedIn={false} />);

    expect(screen.getByLabelText("生年月日の年")).toHaveValue("");

    rerender(<CompassClient savedBirthday="1984-05-15" isLoggedIn />);

    await waitFor(() => expect(screen.getByLabelText("生年月日の年")).toHaveValue("1984"));
  });

  it("ユーザーが先にbirthdayを編集した場合、late hydrationで保存値を上書きしない", async () => {
    const { rerender } = render(<CompassClient savedBirthday={null} isLoggedIn={false} />);

    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "1990" } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "01" } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "01" } });

    rerender(<CompassClient savedBirthday="1984-05-15" isLoggedIn />);

    await waitFor(() => expect(screen.getByLabelText("生年月日の年")).toHaveValue("1990"));
  });

  it("ログイン中はCompassで実際に使ったbirthdayを結果取得後に保存境界へ渡す", async () => {
    const onPersistBirthday = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successResponse()));

    render(<CompassClient savedBirthday="1984-05-15" isLoggedIn onPersistBirthday={onPersistBirthday} />);

    fillPurposeAndOrigin();
    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "1990" } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "01" } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "01" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(await screen.findByText("北西神社")).toBeInTheDocument();
    expect(onPersistBirthday).toHaveBeenCalledTimes(1);
    expect(onPersistBirthday).toHaveBeenCalledWith("1990-01-01");
  });

  it("GuestではCompass結果が成功してもbirthday保存境界を呼ばない", async () => {
    const onPersistBirthday = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successResponse()));

    render(<CompassClient onPersistBirthday={onPersistBirthday} />);
    fillPurposeAndOrigin();
    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "1990" } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "01" } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "01" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(await screen.findByText("北西神社")).toBeInTheDocument();
    expect(onPersistBirthday).not.toHaveBeenCalled();
  });

  it("Compass backend error時はbirthdayを保存しない", async () => {
    const onPersistBirthday = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));

    render(<CompassClient isLoggedIn onPersistBirthday={onPersistBirthday} />);
    fillPurposeAndOrigin();
    fireEvent.change(screen.getByLabelText("生年月日の年"), { target: { value: "1990" } });
    fireEvent.change(screen.getByLabelText("生年月日の月"), { target: { value: "01" } });
    fireEvent.change(screen.getByLabelText("生年月日の日"), { target: { value: "01" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今月の方向を確認する" }));
    });

    expect(await screen.findByText("只今、確認できませんでした")).toBeInTheDocument();
    expect(onPersistBirthday).not.toHaveBeenCalled();
  });
});
