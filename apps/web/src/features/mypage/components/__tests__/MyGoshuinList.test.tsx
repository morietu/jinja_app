// apps/web/src/features/mypage/components/__tests__/MyGoshuinList.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MyGoshuinList from "../MyGoshuinList";
import type { Goshuin } from "@/lib/api/goshuin";

describe("MyGoshuinList", () => {
  it("loading 中はスケルトンを表示する", () => {
    render(<MyGoshuinList items={null} loading={true} error={null} />);
    expect(screen.getByRole("status")).toBeDefined?.(); // 必要なら aria-role 追加して合わせる
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
        is_public: true,
        image_url: "/test.png",
        shrine_name: "テスト神社",
        created_at: "2025-01-01T00:00:00Z",
      },
    ];
    render(<MyGoshuinList items={items} loading={false} error={null} />);
    expect(screen.getByText("テスト神社")).toBeInTheDocument();
    expect(screen.getByText(/登録日/)).toBeInTheDocument();
  });
});
