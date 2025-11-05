// apps/web/src/components/ui/__tests__/card.test.tsx
import { render, screen } from "@testing-library/react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../card"; // ← 修正

describe("Card", () => {
  it("renders header/content/footer", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>タイトル</CardTitle>
        </CardHeader>
        <CardContent>本文</CardContent>
        <CardFooter>フッタ</CardFooter>
      </Card>
    );
    expect(screen.getByText("タイトル")).toBeInTheDocument();
    expect(screen.getByText("本文")).toBeInTheDocument();
    expect(screen.getByText("フッタ")).toBeInTheDocument();
  });
});
