// apps/web/src/components/ui/__tests__/button.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../button"; // ← 修正

describe("Button", () => {
  it("renders with text and handles click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>押す</Button>);
    const btn = screen.getByRole("button", { name: "押す" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("button", { name: "Sec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Danger" })).toBeInTheDocument();
  });
});
