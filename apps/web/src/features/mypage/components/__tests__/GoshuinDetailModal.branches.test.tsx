import React from "react";
import { render } from "@testing-library/react";
import GoshuinDetailModal from "../GoshuinDetailModal";
import type { Goshuin } from "@/lib/api/goshuin";

const baseGoshuin: Goshuin = {
  id: 1,
  shrine: 1,
  is_public: true,
  shrine_name: "テスト神社",
};

describe("GoshuinDetailModal branches", () => {
  it("open=false かつ goshuin ありでレンダー（閉じているパス）", () => {
    const { container } = render(<GoshuinDetailModal open={false} onOpenChange={() => {}} goshuin={baseGoshuin} />);

    // ここではクラッシュしないことだけ確認すれば十分
    expect(container).toBeTruthy();
  });

  it("open=true かつ goshuin ありでレンダー（詳細表示パス）", () => {
    const { container } = render(<GoshuinDetailModal open={true} onOpenChange={() => {}} goshuin={baseGoshuin} />);

    expect(container).toBeTruthy();
  });

  it("open=true かつ goshuin=null でレンダー（null ハンドリングのパス）", () => {
    const { container } = render(<GoshuinDetailModal open={true} onOpenChange={() => {}} goshuin={null} />);

    expect(container).toBeTruthy();
  });

  // ★ 新しく追加するテスト：image_url ありの分岐を踏む
  it("image_url がある場合の画像表示パスを通る", () => {
    const goshuinWithImage: Goshuin = {
      ...baseGoshuin,
      image_url: "https://example.com/goshuin.png",
    };

    const { getByAltText } = render(
      <GoshuinDetailModal open={true} onOpenChange={() => {}} goshuin={goshuinWithImage} />,
    );

    // alt の文言はコンポーネント側の実装に合わせて調整
    expect(getByAltText(/テスト神社/)).toBeInTheDocument();
  });
});
