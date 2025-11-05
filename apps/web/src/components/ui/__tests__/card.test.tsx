import { render, screen } from "@testing-library/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardAction,
} from "../card"; // ← CardActionを追加

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

  it("renders card action", () => {
    render(
      <Card>
        <CardAction>Click me</CardAction>
      </Card>
    );
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
});
