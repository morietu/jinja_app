// apps/web/src/features/mypage/components/__tests__/MyGoshuinList.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyGoshuinList from "../MyGoshuinList";
import type { Goshuin } from "@/lib/api/goshuin";

// GoshuinDetailModal はモックして、開閉状態と渡されたタイトルだけ見る
vi.mock("../GoshuinDetailModal", () => {
  return {
    default: (props: any) => (
      <div data-testid="goshuin-detail-modal" data-open={props.open ? "true" : "false"}>
        {props.goshuin ? (props.goshuin.title ?? "no-title") : "no-goshuin"}
      </div>
    ),
  };
});

describe("MyGoshuinList", () => {
  it("loading 中はスケルトンを表示する", () => {
    render(<MyGoshuinList items={null} loading={true} error={null} />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("error があればエラーメッセージを表示する", () => {
    render(<MyGoshuinList items={null} loading={false} error="エラー" />);
    expect(screen.getByText("エラー")).toBeInTheDocument();
  });

  it("items が空なら空状態メッセージを表示する", () => {
    render(<MyGoshuinList items={[]} loading={false} error={null} />);
    expect(screen.getByText(/まだ御朱印が登録されていません/)).toBeInTheDocument();
  });

  it("items があればカードを表示する", () => {
    const items: Goshuin[] = [
      {
        id: 1,
        shrine: 1,
        title: "テスト御朱印",
        is_public: true,
        shrine_name: "テスト神社",
        image_url: "/test.png",
        created_at: "2025-01-01T00:00:00Z",
      },
    ];

    render(<MyGoshuinList items={items} loading={false} error={null} />);

    // タイトル行
    expect(screen.getByText("テスト御朱印")).toBeInTheDocument();
    // 神社名行
    expect(screen.getByText("テスト神社")).toBeInTheDocument();
    // 日付と公開設定の表示
    expect(screen.getByText(/登録日/)).toBeInTheDocument();
    expect(screen.getByText(/公開設定/)).toBeInTheDocument();
  });

  it("カードクリックでモーダルが開き、選択された御朱印が渡される", () => {
    const items: Goshuin[] = [
      {
        id: 1,
        shrine: 1,
        title: "テスト御朱印",
        is_public: true,
        shrine_name: "テスト神社",
        image_url: "https://example.com/goshuin.png",
      },
    ];

    render(<MyGoshuinList items={items} loading={false} error={null} />);

    const card = screen.getByText("テスト御朱印");
    fireEvent.click(card);

    const modal = screen.getByTestId("goshuin-detail-modal");
    expect(modal.getAttribute("data-open")).toBe("true");
    expect(modal).toHaveTextContent("テスト御朱印");
  });

  it("削除ボタンで confirm キャンセル時は onDelete を呼ばない", () => {
    const onDelete = vi.fn();

    const items: Goshuin[] = [
      {
        id: 1,
        shrine: 1,
        title: "削除テスト",
        is_public: true,
        shrine_name: "テスト神社",
        image_url: "https://example.com/goshuin.png",
      },
    ];

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<MyGoshuinList items={items} loading={false} error={null} onDelete={onDelete} />);

    const deleteButton = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("削除ボタンで confirm OK のとき onDelete が呼ばれ、削除中は disabled になる", async () => {
    let resolveDelete!: () => void;

    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const items: Goshuin[] = [
      {
        id: 1,
        shrine: 1,
        title: "削除テスト",
        is_public: true,
        shrine_name: "テスト神社",
        image_url: "https://example.com/goshuin.png",
      },
    ];

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MyGoshuinList items={items} loading={false} error={null} onDelete={onDelete} />);

    const deleteButton = screen.getByRole("button", { name: "削除" });
    fireEvent.click(deleteButton);

    // onDelete が呼ばれる
    expect(onDelete).toHaveBeenCalledWith(1);

    // 削除中… 表示 & disabled
    expect(screen.getByRole("button", { name: "削除中…" })).toBeDisabled();

    // Promise 解決 → ボタンが元に戻る
    resolveDelete();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "削除" })).not.toBeDisabled();
    });

    confirmSpy.mockRestore();
  });
});
