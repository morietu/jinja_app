// apps/web/src/components/nearby/__tests__/NearbyList.states.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { NearbyListEmpty } from "../NearbyList.Empty";
import { NearbyListError } from "../NearbyList.Error";



describe("NearbyList states", () => {
  it("Empty: uses suggestion and calls onRefetch", () => {
    const onRefetch = vi.fn();
    render(
      <NearbyListEmpty
        suggestion="条件を緩めて再検索してください"
        onRefetch={onRefetch}
      />
    );
    expect(
      screen.getByText("条件を緩めて再検索してください")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再検索" }));
    expect(onRefetch).toHaveBeenCalled();
  });

  it("Error: shows message and calls onRetry", () => {
    const onRetry = vi.fn();
    render(<NearbyListError message="boom" onRetry={onRetry} />);
    expect(screen.getByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
