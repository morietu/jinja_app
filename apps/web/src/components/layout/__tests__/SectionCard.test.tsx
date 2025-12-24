import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionCard } from "../SectionCard";

describe("SectionCard", () => {
  it("title/description/children を表示する", () => {
    render(
      <SectionCard title="T" description="D">
        <div>CHILD</div>
      </SectionCard>,
    );

    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("CHILD")).toBeInTheDocument();
  });

  it("title/description が無いとき header を出さず children だけ表示する", () => {
    const { container } = render(
      <SectionCard>
        <div>ONLY</div>
      </SectionCard>,
    );

    expect(screen.getByText("ONLY")).toBeInTheDocument();
    expect(container.querySelector("header")).toBeNull();
  });
});
