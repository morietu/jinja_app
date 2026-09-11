import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConciergeRouteLayout from "../layout";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";

describe("Concierge page shell background responsibility", () => {
  it("owns the route background with the global semantic background token", () => {
    const { container } = render(
      <ConciergeRouteLayout>
        <div>concierge content</div>
      </ConciergeRouteLayout>,
    );

    const shell = container.querySelector('[data-app-frame="concierge"]');
    expect(shell).not.toBeNull();
    expect(shell).toHaveClass("min-h-full", "w-full", "bg-[var(--kt-color-background-base)]");
  });

  it("keeps the max-width content container free of page-ground colors", () => {
    const { container } = render(
      <ConciergeLayout messages={[]} onSend={vi.fn()} canSend={false}>
        <div>content</div>
      </ConciergeLayout>,
    );

    const contentRoot = container.firstElementChild;
    expect(contentRoot).not.toBeNull();
    expect(contentRoot).toHaveClass("max-w-4xl", "w-full");
    expect(contentRoot).not.toHaveClass("bg-neutral-50");
  });
});
