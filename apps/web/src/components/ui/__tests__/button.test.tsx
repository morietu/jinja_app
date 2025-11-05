// apps/web/src/components/ui/__tests__/button.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../button"; // Buttonコンポーネントのインポート (パス修正)

describe("Button", () => {
  it("calls onClick when button is clicked", () => {
    const onClick = vi.fn(); // モック関数
    render(<Button onClick={onClick}>Click Me</Button>);

    // ボタンがクリックされることをテスト
    fireEvent.click(screen.getByRole("button", { name: "Click Me" }));
    expect(onClick).toHaveBeenCalled(); // onClickが呼ばれたか確認
  });

  it("renders with different variants and sizes", () => {
    render(
      <div>
        <Button variant="destructive" size="sm">
          Small Destructive
        </Button>
        <Button variant="secondary" size="lg">
          Large Secondary
        </Button>
      </div>
    );

    // それぞれのボタンが表示されるか確認
    expect(screen.getByText("Small Destructive")).toBeInTheDocument();
    expect(screen.getByText("Large Secondary")).toBeInTheDocument();
  });

  it("renders with text and handles click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>押す</Button>);

    // "押す" ボタンがクリックされたときの挙動を確認
    const btn = screen.getByRole("button", { name: "押す" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1); // クリックが1回だけ呼ばれることを確認
  });

  it("supports variant/size props", () => {
    render(
      <div>
        <Button variant="secondary" size="sm">
          Sec
        </Button>
        <Button variant="destructive" size="lg">
          Danger
        </Button>
      </div>
    );

    // バリアントとサイズが正しく表示されるか確認
    expect(screen.getByRole("button", { name: "Sec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Danger" })).toBeInTheDocument();
  });
}); // describe の閉じ括弧
