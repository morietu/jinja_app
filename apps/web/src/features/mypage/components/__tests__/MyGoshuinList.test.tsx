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
  // --- 状態別レンダー ---

  it("loading=true のときローディング表示になる", () => {
    render(
      <MyGoshuinList items={null} loading={true} error={null} onDelete={undefined} onToggleVisibility={undefined} />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("登録済みの御朱印")).toBeInTheDocument();
  });

  it("error があるときエラーメッセージが表示される", () => {
    render(
      <MyGoshuinList
        items={null}
        loading={false}
        error="エラーが発生しました"
        onDelete={undefined}
        onToggleVisibility={undefined}
      />,
    );

    expect(screen.getByText("登録済みの御朱印")).toBeInTheDocument();
    expect(screen.getByText("エラーが発生しました")).toBeInTheDocument();
  });

  it("items が空のとき空状態メッセージが表示される", () => {
    render(
      <MyGoshuinList items={[]} loading={false} error={null} onDelete={undefined} onToggleVisibility={undefined} />,
    );

    expect(screen.getByText("登録済みの御朱印")).toBeInTheDocument();
    expect(
      screen.getByText("まだ御朱印が登録されていません。上のフォームからアップロードしてみてください。"),
    ).toBeInTheDocument();
  });

  // --- 通常レンダー ---

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

    expect(screen.getByText("テスト御朱印")).toBeInTheDocument();
    expect(screen.getByText("テスト神社")).toBeInTheDocument();
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

  // --- 削除ボタン ---

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

    expect(onDelete).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "削除中…" })).toBeDisabled();

    resolveDelete();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "削除" })).not.toBeDisabled();
    });

    confirmSpy.mockRestore();
  });

    it("公開⇔非公開ボタンで onToggleVisibility が呼ばれ、切り替え中は disabled になる", async () => {
      let resolveToggle!: () => void;

      const onToggleVisibility = vi.fn(
        (_id: number, _next: boolean) =>
          new Promise<void>((resolve) => {
            resolveToggle = resolve;
          }),
      );

      const items: Goshuin[] = [
        {
          id: 1,
          shrine: 1,
          title: "公開設定テスト",
          is_public: true, // ← 初期状態は「公開」
          shrine_name: "テスト神社",
          image_url: "https://example.com/goshuin.png",
        },
      ];

      render(
        <MyGoshuinList
          items={items}
          loading={false}
          error={null}
          onDelete={undefined}
          onToggleVisibility={onToggleVisibility}
        />,
      );

      // 初期は「非公開にする」ボタン
      const toggleButton = screen.getByRole("button", { name: "非公開にする" });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).not.toBeDisabled();

      // クリック → onToggleVisibility が (1, false) で呼ばれるはず
      fireEvent.click(toggleButton);
      expect(onToggleVisibility).toHaveBeenCalledWith(1, false);

      // 呼び出し中は「切り替え中…」表示 & disabled
      const pendingButton = screen.getByRole("button", { name: "切り替え中…" });
      expect(pendingButton).toBeDisabled();

      // Promise 解決 → ボタンが再び有効になる（ラベルは props が変わらないので「非公開にする」に戻る想定）
      resolveToggle();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "非公開にする" })).not.toBeDisabled();
      });
    });
});
