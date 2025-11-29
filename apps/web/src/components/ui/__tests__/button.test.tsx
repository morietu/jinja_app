// apps/web/src/components/ui/__tests__/button.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  it("calls onClick when button is clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click Me</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Click Me" }));
    expect(onClick).toHaveBeenCalled();
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
      </div>,
    );

    expect(screen.getByText("Small Destructive")).toBeInTheDocument();
    expect(screen.getByText("Large Secondary")).toBeInTheDocument();
  });

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
      </div>,
    );

    expect(screen.getByRole("button", { name: "Sec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Danger" })).toBeInTheDocument();
  });

  it("asChild=true では子要素をそのまま使う", () => {
    render(
      <Button asChild>
        <a href="/mypage">マイページリンク</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "マイページリンク" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/mypage");
  });
});
